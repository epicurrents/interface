/**
 * Assert the scalp field renderer's invariants, orientation above all.
 *
 * The orientation invariants are coupled — through the sign of the view matrix's determinant, the
 * front-face winding it implies, and the drag signs that follow the screen-x row — so checking them
 * one at a time lets a compensating pair of errors pass, which is exactly what happened repeatedly
 * while the renderer was being written. Run all six together or that part is worthless.
 *
 * Two further checks cover regressions that reached a running application: a renderer built against
 * an older eeg-module must degrade rather than throw, and electrodes must actually be visible from
 * behind the head. Both are here rather than in a unit test only because this package has no test
 * runner; they belong in one once it does.
 *
 * The assertions are landmark tests: the mesh is painted by an anatomical axis and the red and blue
 * pixel counts are compared. That is deliberately cruder than comparing against a reference image,
 * because a reference image also fails on a lighting tweak, and then nobody trusts the test.
 *
 *     npm i -D playwright esbuild && npx playwright install chromium
 *     node scripts/verify-topography.mjs
 *
 * Set PLAYWRIGHT_CHROMIUM to an existing browser binary to skip the download.
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const MODULE_ROOT = fileURLToPath(new URL('../../epicurrents/eeg-module', import.meta.url))
const SIZE = 420
/** Difference in a colour channel that counts as "this pixel is that landmark colour". */
const CHANNEL_MARGIN = 30
/** Pixels the dragged patch must travel before the drag counts as directional rather than as noise. */
const DRAG_MARGIN = 5
/** Yaw that puts the occiput towards the viewer, where the buried-marker problem shows. */
const OCCIPUT_YAW = 2.6

const ENTRY = `
import { ScalpFieldRenderer } from '${join(ROOT, 'src/components/plots/topography')}'
import { EegSurfaceFieldMap } from '${join(MODULE_ROOT, 'src/topography')}'

const LABELS = 'Fp1,Fp2,F7,F3,Fz,F4,F8,T7,C3,Cz,C4,T8,P7,P3,Pz,P4,P8,O1,O2'.split(',')
const match = EegSurfaceFieldMap.forLabels(LABELS)
const canvas = document.getElementById('gl')
const renderer = new ScalpFieldRenderer(canvas, match.map)
const colors = new Float32Array(match.map.vertices.length)

/** Paint the mesh by an anatomical axis: red on the high side, blue on the low side. */
window.paintByAxis = (axis) => {
    const vertices = match.map.vertices
    let lo = Infinity, hi = -Infinity
    for (let v = 0; v < match.map.nVertices; v++) {
        lo = Math.min(lo, vertices[v*3 + axis])
        hi = Math.max(hi, vertices[v*3 + axis])
    }
    const mid = (lo + hi)/2
    for (let v = 0; v < match.map.nVertices; v++) {
        const high = vertices[v*3 + axis] > mid
        colors[v*3] = high ? 0.85 : 0.10
        colors[v*3 + 1] = 0.10
        colors[v*3 + 2] = high ? 0.10 : 0.85
    }
    renderer.setColors(colors)
    renderer.render()
}

/** Paint one small red patch on the anterior-superior scalp, to be followed through a drag. */
window.paintPatch = () => {
    const vertices = match.map.vertices
    let best = -Infinity, index = 0
    for (let v = 0; v < match.map.nVertices; v++) {
        const score = vertices[v*3 + 1] + vertices[v*3 + 2]*0.4
        if (score > best) {
            best = score
            index = v
        }
    }
    const [bx, by, bz] = [vertices[index*3], vertices[index*3 + 1], vertices[index*3 + 2]]
    for (let v = 0; v < match.map.nVertices; v++) {
        const hit = Math.hypot(
            vertices[v*3] - bx, vertices[v*3 + 1] - by, vertices[v*3 + 2] - bz
        ) < 0.028
        colors[v*3] = hit ? 0.95 : 0.45
        colors[v*3 + 1] = hit ? 0.05 : 0.45
        colors[v*3 + 2] = hit ? 0.05 : 0.45
    }
    renderer.setColors(colors)
    renderer.render()
}

window.setView = (yaw, pitch) => {
    renderer.yaw = yaw
    renderer.pitch = pitch
    renderer.render()
}

/**
 * A field map as an eeg-module build from before surface-projected electrodes would expose it.
 *
 * The two packages build separately, so the interface can legitimately run a release ahead of the module. When it
 * does, the renderer must degrade to the raw montage positions rather than fail — a throw here does not merely blank
 * the surface, it abandons whatever the mounting component was doing when it called the constructor.
 */
const stale = Object.create(Object.getPrototypeOf(match.map))
Object.assign(stale, match.map)
Object.defineProperty(stale, 'electrodeAnchors', { get: () => undefined })

window.survivesStaleFieldMap = () => {
    try {
        return new ScalpFieldRenderer(document.getElementById('stale'), stale, { interactive: false }).available
    } catch (error) {
        return \`threw: \${error.message}\`
    }
}

/**
 * Count marker pixels visible from behind the head, for one source of electrode positions.
 *
 * The read-back has to happen in the same task as the draw, because the context is not created with
 * preserveDrawingBuffer and the browser clears it once the frame is composited.
 */
window.markerPixels = (id, useAnchors) => {
    const canvas = document.getElementById(id)
    const view = new ScalpFieldRenderer(canvas, useAnchors ? match.map : stale, { interactive: false })
    const flat = new Float32Array(match.map.vertices.length).fill(0.75)
    view.setColors(flat)
    view.setSelectedElectrodes(match.map.channels.map((_channel, index) => index))
    view.yaw = ${OCCIPUT_YAW}
    view.pitch = -0.10
    view.render()
    const target = document.createElement('canvas')
    target.width = canvas.width
    target.height = canvas.height
    const context = target.getContext('2d')
    context.drawImage(canvas, 0, 0)
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data
    let count = 0
    for (let i = 0; i < data.length; i += 4) {
        // The selected-electrode yellow, which nothing else on a flat grey head can be confused with.
        if (data[i] > 200 && data[i + 1] > 150 && data[i + 2] < 120) {
            count++
        }
    }
    return count
}

window.rendererReady = true
`

const build = () => {
    const dir = mkdtempSync(join(tmpdir(), 'topography-'))
    const entry = join(dir, 'entry.ts')
    const bundle = join(dir, 'bundle.js')
    // The renderer logs through scoped-event-log, which is a peer dependency of the app rather than
    // of this script. Only the errors it reports matter here, and those surface as page errors.
    const log = join(dir, 'log.ts')
    writeFileSync(log, 'export const Log = { debug () {}, error () {}, info () {}, warn () {} }\n')
    writeFileSync(entry, ENTRY)
    execFileSync('npx', [
        '--yes', 'esbuild', entry, '--bundle', `--outfile=${bundle}`, '--format=iife',
        `--alias:#types=${join(ROOT, 'src/types')}`,
        `--alias:#config=${join(MODULE_ROOT, 'src/config')}`,
        `--alias:scoped-event-log=${log}`,
        '--loader:.json=json',
    ], { stdio: ['ignore', 'ignore', 'inherit'] })
    const page = join(dir, 'page.html')
    writeFileSync(page, `<!doctype html><html><body style="margin:0;background:#000">
<canvas id="gl" width="${SIZE}" height="${SIZE}"></canvas>
<canvas id="stale" width="${SIZE}" height="${SIZE}"></canvas>
<canvas id="anchored" width="${SIZE}" height="${SIZE}"></canvas>
<canvas id="raw" width="${SIZE}" height="${SIZE}"></canvas>
<script src="bundle.js"></script></body></html>`)
    return page
}

/** Count pixels that read as red and as blue in a PNG buffer. */
const countRedBlue = async (buffer) => {
    const bitmap = await sharpLike(buffer)
    let red = 0, blue = 0
    for (let i = 0; i < bitmap.length; i += 4) {
        if (bitmap[i] - bitmap[i + 2] > CHANNEL_MARGIN) {
            red++
        }
        if (bitmap[i + 2] - bitmap[i] > CHANNEL_MARGIN) {
            blue++
        }
    }
    return { blue, red }
}

/** Mean x of the red pixels, as a fraction of the width. */
const redCentroid = async (buffer) => {
    const bitmap = await sharpLike(buffer)
    let sum = 0, count = 0
    for (let i = 0; i < bitmap.length; i += 4) {
        if (bitmap[i] - bitmap[i + 2] > CHANNEL_MARGIN) {
            sum += (i/4)%SIZE
            count++
        }
    }
    return count ? sum/count/SIZE : 0.5
}

/** Centre of the saturated-red patch, in pixels, or null when it is not visible. */
const patchCentre = async (buffer) => {
    const bitmap = await sharpLike(buffer)
    let sx = 0, sy = 0, count = 0
    for (let i = 0; i < bitmap.length; i += 4) {
        if (bitmap[i] - bitmap[i + 1] > 60 && bitmap[i] - bitmap[i + 2] > 60) {
            sx += (i/4)%SIZE
            sy += Math.floor((i/4)/SIZE)
            count++
        }
    }
    return count > 20 ? { x: sx/count, y: sy/count } : null
}

/** Decode a PNG to RGBA bytes using the page itself, so no image library is needed. */
let decodePage = null
const sharpLike = async (buffer) => {
    return decodePage.evaluate(async (data) => {
        const blob = new Blob([new Uint8Array(data)], { type: 'image/png' })
        const bitmap = await createImageBitmap(blob)
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const context = canvas.getContext('2d')
        context.drawImage(bitmap, 0, 0)
        return Array.from(context.getImageData(0, 0, bitmap.width, bitmap.height).data)
    }, Array.from(buffer))
}

const main = async () => {
    const harness = build()
    const browser = await chromium.launch({
        args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
        executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
    })
    const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { height: 520, width: 470 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    decodePage = await browser.newPage()
    await page.goto(`file://${harness}`)
    await page.waitForFunction(() => window.rendererReady, null, { timeout: 20000 })

    const shot = async (yaw, pitch) => {
        await page.evaluate(([y, p]) => window.setView(y, p), [yaw, pitch])
        return page.locator('#gl').screenshot()
    }

    await page.evaluate(() => window.paintByAxis(1))
    const anterior = await countRedBlue(await shot(0, 0))
    const posterior = await countRedBlue(await shot(Math.PI, 0))
    await page.evaluate(() => window.paintByAxis(0))
    const facing = await redCentroid(await shot(0, 0))
    const behind = await redCentroid(await shot(Math.PI, 0))

    await page.evaluate(() => {
        window.paintPatch()
        window.setView(0, 0)
    })
    const box = await page.locator('#gl').boundingBox()
    const [cx, cy] = [box.x + box.width/2, box.y + box.height/2]
    const start = await patchCentre(await page.locator('#gl').screenshot())
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + 70, cy, { steps: 6 })
    await page.mouse.up()
    const right = await patchCentre(await page.locator('#gl').screenshot())
    await page.evaluate(() => window.setView(0, 0))
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx, cy - 70, { steps: 6 })
    await page.mouse.up()
    const up = await patchCentre(await page.locator('#gl').screenshot())

    const survives = await page.evaluate(() => window.survivesStaleFieldMap())
    const anchored = await page.evaluate(() => window.markerPixels('anchored', true))
    const raw = await page.evaluate(() => window.markerPixels('raw', false))

    const checks = [
        ['a field map without surface anchors degrades instead of throwing', survives === true],
        // Relative rather than absolute: what matters is that projecting the electrodes onto the mesh
        // reveals markers the raw montage positions leave buried, not any particular pixel count.
        ['projecting electrodes onto the mesh makes more of them visible from behind', anchored > raw],
        ['yaw 0 shows the face (anterior)', anterior.red > anterior.blue],
        ['yaw pi shows the back (posterior)', posterior.blue > posterior.red],
        ["facing the subject, their right is on the viewer's left", facing < 0.5],
        ["from behind, their right is on the viewer's right", behind > 0.5],
        ['dragging right moves the surface right', Boolean(start && right && right.x > start.x + DRAG_MARGIN)],
        ['dragging up moves the surface up', Boolean(start && up && up.y < start.y - DRAG_MARGIN)],
    ]
    for (const [name, ok] of checks) {
        console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}`)
    }
    console.log(`  markers visible from behind: ${anchored} px projected vs ${raw} px unprojected`)
    if (errors.length) {
        console.log(`  page errors: ${errors.join(', ')}`)
    }
    await browser.close()
    const passed = checks.every(([, ok]) => ok) && !errors.length
    console.log(passed ? 'ALL PASS' : 'FAILURES PRESENT')
    process.exit(passed ? 0 : 1)
}

main()
