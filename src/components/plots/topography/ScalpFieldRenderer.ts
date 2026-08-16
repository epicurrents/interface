/**
 * WebGL renderer for a 3D scalp voltage field map.
 *
 * The field itself is computed elsewhere; this class only draws what `EegSurfaceFieldMap` hands over — a static mesh
 * with per-vertex normals and ambient occlusion, a per-vertex colour buffer that changes every frame, optional contour
 * segments, and electrode markers.
 *
 * Several of the decisions below look arbitrary and are not. They were established by measurement and are coupled to
 * each other, so change them together or not at all:
 *
 * - **The view matrix must have determinant -1.** Head coordinates are right-handed; WebGL clip space (+x right, +y
 *   up, +z into the screen) is left-handed. A proper rotation silently *mirrors* the head, putting the subject's right
 *   on the viewer's right while facing them. Everything else still looks plausible, which is what makes it hard to
 *   catch.
 * - **Screen-space winding follows that determinant**, so `frontFace` is coupled to the matrix, and the drag signs are
 *   coupled to the screen-x sign.
 * - **Backfaces are not culled.** The shell is open at the neck, and with the interior missing, contours on the far
 *   side show through the opening and read as extra isopotentials. The inside is drawn as flat grey instead.
 * - **The key light is overhead in view space, never a headlamp.** Measured on a flat-coloured head with occlusion
 *   disabled, a light pointing at the viewer gives a shading standard deviation of 10 against 36 for an overhead key
 *   at the same mean brightness. A headlamp flattens the face to a silhouette.
 * - **Contours and markers lie exactly on the surface**, so the mesh is pushed away from the viewer by a constant
 *   depth bias in its vertex shader. `gl.polygonOffset` is unreliable across rasterisers, and a uniform scale about
 *   the mesh centre is wrong because a head is not a sphere.
 *
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { Log } from 'scoped-event-log'
import type { EegSurfaceFieldMapInterface, Isoline3D } from '@epicurrents/eeg-module/types'
import type { ScalpFieldRendererOptions } from '#types/plot'

const SCOPE = 'ScalpFieldRenderer'

/** Fraction of the viewport the head's widest axis fills. */
const FILL = 0.94
/**
 * Depth bias applied to the mesh, in a clip-z range of +-0.33. Large enough that contours drawn on an almost edge-on
 * scalp still win the depth test, small enough not to let the far side of the head through.
 */
const DEPTH_BIAS = 0.0025
/** Compression of head depth into clip z, so a rotated head never leaves the -1..1 clip volume. */
const DEPTH_SCALE = 0.35
/** Radians of rotation per pixel of pointer travel. */
const DRAG_SPEED = 0.01

const VERTEX_SHADER = `
attribute vec3 aPos;
attribute vec3 aNrm;
attribute vec3 aCol;
attribute float aAO;
uniform mat4 uMV;
uniform float uZBias;
uniform float uPointSize;
varying vec3 vCol;
varying vec3 vNrm;
varying float vAO;
void main () {
    vCol = aCol;
    vAO = aAO;
    vNrm = normalize((uMV*vec4(aNrm, 0.0)).xyz);
    vec4 p = uMV*vec4(aPos, 1.0);
    p.z = p.z*${DEPTH_SCALE.toFixed(2)} + uZBias;
    gl_PointSize = uPointSize;
    gl_Position = vec4(p.xyz, 1.0);
}`

const FRAGMENT_SHADER = `
precision mediump float;
varying vec3 vCol;
varying vec3 vNrm;
varying float vAO;
uniform vec3 uLight;
uniform vec3 uShade;
uniform float uAO;
uniform float uFlat;
uniform float uRound;
void main () {
    if (uFlat > 0.5) {
        // gl_PointCoord is only defined while drawing points, hence the uniform rather than a test
        // on the primitive: a square marker reads as a dead pixel block on a curved surface.
        if (uRound > 0.5 && length(gl_PointCoord - vec2(0.5)) > 0.5) {
            discard;
        }
        // Markers and contours carry their own colour and must not be shaded, or one on the unlit
        // side of the head fades into the scalp it is supposed to stand out from.
        gl_FragColor = vec4(vCol, 1.0);
        return;
    }
    vec3 N = normalize(vNrm);
    vec3 L = normalize(uLight);
    vec3 base = vCol;
    if (!gl_FrontFacing) {
        N = -N;
        base = vec3(0.30, 0.31, 0.34);
    }
    // Wrapped diffuse, half-Lambert style. The terminator on a head is soft, and a hard max(dot, 0)
    // drops everything facing away from the key to flat ambient, which is what kills the temples.
    float d = pow(clamp((dot(N, L) + uShade.z)/(1.0 + uShade.z), 0.0, 1.0), 1.0 + uShade.z);
    float occ = 1.0 - uAO*smoothstep(0.34, 0.88, vAO);
    float l = (uShade.x + uShade.y*d)*occ;
    float spec = pow(max(dot(reflect(-L, N), vec3(0.0, 0.0, 1.0)), 0.0), 22.0)*0.045*occ;
    gl_FragColor = vec4(base*l + vec3(spec), 1.0);
}`

/** Values arrived at by a lighting sweep; see the class docstring for why they are not free parameters. */
const DEFAULT_OPTIONS = {
    activeElectrodeColor: [1.0, 0.85, 0.15] as [number, number, number],
    // Transparent, so the surface sits on whatever the panel behind it is and follows the theme.
    // Every fragment the head covers is written at alpha 1, so only the surround stays clear.
    background: [0, 0, 0, 0] as [number, number, number, number],
    contourColor: [1, 1, 1] as [number, number, number],
    electrodeColor: [0.16, 0.17, 0.20] as [number, number, number],
    interactive: true,
    light: [0.20, 0.88, 0.43] as [number, number, number],
    occlusion: 0.10,
    // Brightness and form pull against each other: an overhead key genuinely darkens the lower face. The remedy is
    // this ambient/diffuse/wrap split, never moving the light back towards the camera.
    shade: [0.66, 0.72, 0.45] as [number, number, number],
}
/** Default yaw, and a pitch that looks slightly down. From below, the open neck shows grey interior across 13% of the head; from here, 1%. */
const DEFAULT_YAW = -0.62
const DEFAULT_PITCH = -0.10

export default class ScalpFieldRenderer {
    protected _canvas: HTMLCanvasElement
    protected _center: [number, number, number] = [0, 0, 0]
    protected _colorBuffer: WebGLBuffer | null = null
    protected _context: WebGLRenderingContext | null = null
    protected _drag: [number, number] | null = null
    protected _electrodeBuffer: WebGLBuffer | null = null
    /** Normalised electrode positions, in the field map's channel order. */
    protected _electrodes = new Float32Array(0)
    protected _half = 1
    protected _indexBuffer: WebGLBuffer | null = null
    protected _lineBuffer: WebGLBuffer | null = null
    protected _lineVertices = new Float32Array(0)
    protected _map: EegSurfaceFieldMapInterface
    protected _normalBuffer: WebGLBuffer | null = null
    protected _occlusionBuffer: WebGLBuffer | null = null
    protected _options: typeof DEFAULT_OPTIONS
    protected _pitch = DEFAULT_PITCH
    protected _positionBuffer: WebGLBuffer | null = null
    protected _program: WebGLProgram | null = null
    protected _selected: number[] = []
    protected _yaw = DEFAULT_YAW

    /**
     * @param canvas - Canvas to draw on. The renderer takes over its WebGL context but not its layout.
     * @param map - Decoded surface field map supplying the mesh.
     * @param options - Appearance and interaction overrides.
     */
    constructor (canvas: HTMLCanvasElement, map: EegSurfaceFieldMapInterface, options?: ScalpFieldRendererOptions) {
        this._canvas = canvas
        this._map = map
        this._options = { ...DEFAULT_OPTIONS, ...(options ?? {}) }
        this._context = canvas.getContext('webgl', {
            alpha: true,
            antialias: true,
            // The shader emits opaque fragments only, so premultiplication is a no-op here; leaving
            // it on keeps the compositor on its fast path.
            premultipliedAlpha: true,
            preserveDrawingBuffer: false,
        }) as WebGLRenderingContext | null
        if (!this._context) {
            Log.error(`Could not create a WebGL context for the scalp field map.`, SCOPE)
            return
        }
        // Setting up a renderer must not be able to throw into its caller. A component that mounts
        // this also has layout work to do, and an exception here would abandon that work half-done,
        // leaving canvases at their default size rather than merely leaving the surface blank —
        // failing far louder, and somewhere else, than the thing that actually went wrong.
        try {
            this._createProgram()
            this._createBuffers()
        } catch (error) {
            Log.error(
                `Preparing the scalp field map failed: ${(error as Error)?.message ?? error}.`, SCOPE
            )
            this._program = null
            return
        }
        if (this._options.interactive) {
            this._canvas.addEventListener('pointerdown', this._onPointerDown)
            this._canvas.addEventListener('pointermove', this._onPointerMove)
            this._canvas.addEventListener('pointerup', this._onPointerUp)
            this._canvas.addEventListener('pointercancel', this._onPointerUp)
        }
    }

    /** True when a WebGL context was obtained and the mesh is ready to draw. */
    get available () {
        return this._context !== null && this._program !== null
    }
    /** Camera pitch in radians; positive looks up at the head from below. */
    get pitch () {
        return this._pitch
    }
    set pitch (value: number) {
        // Clamped rather than wrapped: past the poles the head rolls, and there is no view of a head
        // from directly above that a reader would recognise faster than a tilted one.
        this._pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, value))
    }
    /** Camera yaw in radians. */
    get yaw () {
        return this._yaw
    }
    set yaw (value: number) {
        this._yaw = value
    }

    protected _createBuffers () {
        const gl = this._context
        if (!gl) {
            return
        }
        // Centre on the bounding box and scale so the widest axis fills the viewport.
        const vertices = Float32Array.from(this._map.vertices)
        const lo = [Infinity, Infinity, Infinity]
        const hi = [-Infinity, -Infinity, -Infinity]
        for (let v = 0; v < vertices.length; v += 3) {
            for (let k = 0; k < 3; k++) {
                lo[k] = Math.min(lo[k], vertices[v + k])
                hi[k] = Math.max(hi[k], vertices[v + k])
            }
        }
        this._center = [(lo[0] + hi[0])/2, (lo[1] + hi[1])/2, (lo[2] + hi[2])/2]
        this._half = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])/2
        for (let v = 0; v < vertices.length; v += 3) {
            for (let k = 0; k < 3; k++) {
                vertices[v + k] = this._normalizeAxis(vertices[v + k], k)
            }
        }
        // The anchors rather than the raw montage positions: the latter sit inside the mesh over much
        // of the posterior scalp, where the depth test then hides them entirely. The fallback covers a
        // field map built before anchors existed — this package and the eeg-module are versioned and
        // built separately, so the two can be a release apart at runtime.
        if (!this._map.electrodeAnchors) {
            Log.warn(
                `The field map has no surface-projected electrodes, so markers are drawn at their montage ` +
                `positions and the posterior ones will be hidden inside the mesh. The eeg-module build ` +
                `predates them; rebuild that package.`,
                SCOPE
            )
        }
        this._electrodes = Float32Array.from(this._map.electrodeAnchors ?? this._map.electrodes)
        for (let e = 0; e < this._electrodes.length; e += 3) {
            for (let k = 0; k < 3; k++) {
                this._electrodes[e + k] = this._normalizeAxis(this._electrodes[e + k], k)
            }
        }
        this._positionBuffer = this._createAttributeBuffer(vertices, 'aPos', 3, gl.STATIC_DRAW)
        this._normalBuffer = this._createAttributeBuffer(
            Float32Array.from(this._map.normals), 'aNrm', 3, gl.STATIC_DRAW
        )
        this._colorBuffer = this._createAttributeBuffer(
            new Float32Array(this._map.vertices.length), 'aCol', 3, gl.DYNAMIC_DRAW
        )
        this._occlusionBuffer = this._createAttributeBuffer(
            Float32Array.from(this._map.ao), 'aAO', 1, gl.STATIC_DRAW
        )
        this._lineBuffer = gl.createBuffer()
        this._electrodeBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, this._electrodeBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, this._electrodes, gl.STATIC_DRAW)
        this._indexBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer)
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._map.triangles, gl.STATIC_DRAW)
        gl.enable(gl.DEPTH_TEST)
        // Coupled to the determinant of the view matrix: with det -1, outward faces come out
        // counter-clockwise. Nothing is culled, but this is what gl_FrontFacing keys off.
        gl.frontFace(gl.CCW)
        gl.disable(gl.CULL_FACE)
        const background = this._options.background
        gl.clearColor(background[0], background[1], background[2], background[3])
    }

    protected _createAttributeBuffer (data: Float32Array, attribute: string, size: number, usage: number) {
        const gl = this._context
        if (!gl || !this._program) {
            return null
        }
        const buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, data, usage)
        const location = gl.getAttribLocation(this._program, attribute)
        gl.enableVertexAttribArray(location)
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0)
        return buffer
    }

    protected _createProgram () {
        const gl = this._context
        if (!gl) {
            return
        }
        const program = gl.createProgram()
        if (!program) {
            Log.error(`Could not create a WebGL program for the scalp field map.`, SCOPE)
            return
        }
        for (const [type, source] of [
            [gl.VERTEX_SHADER, VERTEX_SHADER], [gl.FRAGMENT_SHADER, FRAGMENT_SHADER],
        ] as [number, string][]) {
            const shader = gl.createShader(type)
            if (!shader) {
                Log.error(`Could not create a WebGL shader for the scalp field map.`, SCOPE)
                return
            }
            gl.shaderSource(shader, source)
            gl.compileShader(shader)
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                Log.error(`Compiling a scalp field map shader failed: ${gl.getShaderInfoLog(shader)}.`, SCOPE)
                return
            }
            gl.attachShader(program, shader)
        }
        gl.linkProgram(program)
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            Log.error(`Linking the scalp field map program failed: ${gl.getProgramInfoLog(program)}.`, SCOPE)
            return
        }
        gl.useProgram(program)
        this._program = program
    }

    /** Map one head coordinate into the -1..1 cube the shader draws in. */
    protected _normalizeAxis (value: number, axis: number) {
        return (value - this._center[axis])/this._half*FILL
    }

    protected _onPointerDown = (event: PointerEvent) => {
        this._drag = [event.clientX, event.clientY]
        this._canvas.setPointerCapture(event.pointerId)
    }

    protected _onPointerMove = (event: PointerEvent) => {
        if (!this._drag) {
            return
        }
        // Both signs follow the screen-x sign of the view matrix: with the negated screen-x row, the
        // head must turn towards the pointer, not away from it.
        this.yaw = this._yaw - (event.clientX - this._drag[0])*DRAG_SPEED
        this.pitch = this._pitch - (event.clientY - this._drag[1])*DRAG_SPEED
        this._drag = [event.clientX, event.clientY]
        this.render()
    }

    protected _onPointerUp = (event: PointerEvent) => {
        this._drag = null
        if (this._canvas.hasPointerCapture(event.pointerId)) {
            this._canvas.releasePointerCapture(event.pointerId)
        }
    }

    /**
     * The model-view matrix, column-major.
     *
     * Two independent sign constraints, easy to conflate:
     * 1. Depth must increase away from the viewer, because `gl.LESS` keeps the smaller z. Backwards, the far surface
     *    is drawn and the head reads as rotating the wrong way.
     * 2. The 3x3 part must have determinant -1, not +1, for the handedness reason in the class docstring.
     */
    protected _viewMatrix () {
        const cy = Math.cos(this._yaw), sy = Math.sin(this._yaw)
        const cp = Math.cos(this._pitch), sp = Math.sin(this._pitch)
        return new Float32Array([
            -cy, -sy*sp,  sy*cp, 0,
            -sy,  cy*sp, -cy*cp, 0,
              0,     cp,     sp, 0,
              0,      0,      0, 1,
        ])
    }

    /** Release the WebGL resources and stop listening for pointer events. */
    destroy () {
        this._canvas.removeEventListener('pointerdown', this._onPointerDown)
        this._canvas.removeEventListener('pointermove', this._onPointerMove)
        this._canvas.removeEventListener('pointerup', this._onPointerUp)
        this._canvas.removeEventListener('pointercancel', this._onPointerUp)
        const gl = this._context
        if (!gl) {
            return
        }
        for (const buffer of [
            this._colorBuffer, this._electrodeBuffer, this._indexBuffer, this._lineBuffer,
            this._normalBuffer, this._occlusionBuffer, this._positionBuffer,
        ]) {
            if (buffer) {
                gl.deleteBuffer(buffer)
            }
        }
        if (this._program) {
            gl.deleteProgram(this._program)
        }
        this._context = null
        this._program = null
    }

    /** Restore the default camera orientation. */
    resetView () {
        this._yaw = DEFAULT_YAW
        this._pitch = DEFAULT_PITCH
    }

    /**
     * Draw one frame from the currently uploaded colours, contours and markers.
     */
    render () {
        const gl = this._context
        const program = this._program
        if (!gl || !program) {
            return
        }
        const uniform = (name: string) => gl.getUniformLocation(program, name)
        gl.viewport(0, 0, this._canvas.width, this._canvas.height)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        gl.uniformMatrix4fv(uniform('uMV'), false, this._viewMatrix())
        gl.uniform3fv(uniform('uLight'), this._options.light)
        gl.uniform3fv(uniform('uShade'), this._options.shade)
        gl.uniform1f(uniform('uAO'), this._options.occlusion)
        gl.uniform1f(uniform('uPointSize'), 1)
        gl.uniform1f(uniform('uFlat'), 0)
        // Only the mesh is biased, so everything drawn afterwards sits in front of it.
        gl.uniform1f(uniform('uZBias'), DEPTH_BIAS)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer)
        gl.drawElements(gl.TRIANGLES, this._map.triangles.length, gl.UNSIGNED_SHORT, 0)
        gl.uniform1f(uniform('uZBias'), 0)
        gl.uniform1f(uniform('uFlat'), 1)
        this._renderOverlay(this._lineVertices, gl.LINES, this._options.contourColor, 1)
        this._renderElectrodes()
        this._restoreMeshAttributes()
    }

    /** Draw the electrode markers, the selected ones highlighted. */
    protected _renderElectrodes () {
        const gl = this._context
        if (!gl || !this._electrodes.length) {
            return
        }
        const selected = new Set(this._selected)
        const plain: number[] = []
        const active: number[] = []
        for (let e = 0; e < this._electrodes.length/3; e++) {
            const target = selected.has(e) ? active : plain
            target.push(this._electrodes[e*3], this._electrodes[e*3 + 1], this._electrodes[e*3 + 2])
        }
        this._renderOverlay(Float32Array.from(plain), gl.POINTS, this._options.electrodeColor, 5)
        // Drawn last and larger, so a selected electrode is never hidden under a neighbour's marker.
        this._renderOverlay(Float32Array.from(active), gl.POINTS, this._options.activeElectrodeColor, 9)
    }

    /**
     * Draw an unshaded overlay from a standalone vertex array, temporarily detaching the per-vertex attributes.
     * @param vertices - Flat xyz triples, already normalised into the -1..1 cube.
     * @param mode - `gl.LINES` or `gl.POINTS`.
     * @param color - Flat RGB colour.
     * @param pointSize - Point diameter in pixels; ignored for lines.
     */
    protected _renderOverlay (
        vertices: Float32Array,
        mode: number,
        color: [number, number, number],
        pointSize: number,
    ) {
        const gl = this._context
        if (!gl || !this._program || !vertices.length) {
            return
        }
        const position = gl.getAttribLocation(this._program, 'aPos')
        const colorAttribute = gl.getAttribLocation(this._program, 'aCol')
        const normal = gl.getAttribLocation(this._program, 'aNrm')
        const occlusion = gl.getAttribLocation(this._program, 'aAO')
        gl.uniform1f(gl.getUniformLocation(this._program, 'uRound'), mode === gl.POINTS ? 1 : 0)
        gl.bindBuffer(gl.ARRAY_BUFFER, mode === gl.LINES ? this._lineBuffer : this._electrodeBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW)
        gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0)
        gl.disableVertexAttribArray(colorAttribute)
        gl.disableVertexAttribArray(normal)
        gl.disableVertexAttribArray(occlusion)
        gl.vertexAttrib3f(colorAttribute, color[0], color[1], color[2])
        gl.vertexAttrib3f(normal, 0, 0, 1)
        gl.vertexAttrib1f(occlusion, 0)
        gl.uniform1f(gl.getUniformLocation(this._program, 'uPointSize'), pointSize)
        gl.drawArrays(mode, 0, vertices.length/3)
        gl.enableVertexAttribArray(colorAttribute)
        gl.enableVertexAttribArray(normal)
        gl.enableVertexAttribArray(occlusion)
    }

    /** Point the per-vertex attributes back at the mesh buffers after an overlay draw. */
    protected _restoreMeshAttributes () {
        const gl = this._context
        if (!gl || !this._program) {
            return
        }
        for (const [buffer, attribute, size] of [
            [this._colorBuffer, 'aCol', 3], [this._normalBuffer, 'aNrm', 3],
            [this._occlusionBuffer, 'aAO', 1], [this._positionBuffer, 'aPos', 3],
        ] as [WebGLBuffer, string, number][]) {
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
            gl.vertexAttribPointer(gl.getAttribLocation(this._program, attribute), size, gl.FLOAT, false, 0, 0)
        }
    }

    /**
     * Upload a new per-vertex colour buffer.
     * @param colors - `nVertices * 3` components in the range 0..1, as `EegSurfaceFieldMap.colors` produces.
     */
    setColors (colors: Float32Array) {
        const gl = this._context
        if (!gl || !this._colorBuffer) {
            return
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this._colorBuffer)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, colors)
    }

    /**
     * Replace the drawn field contours.
     * @param isolines - Contour segments in head coordinates, or null to draw none.
     */
    setIsolines (isolines: Isoline3D[] | null) {
        let total = 0
        for (const line of isolines ?? []) {
            total += line.points.length
        }
        const vertices = new Float32Array(total)
        let o = 0
        for (const line of isolines ?? []) {
            for (let i = 0; i < line.points.length; i += 3) {
                vertices[o++] = this._normalizeAxis(line.points[i], 0)
                vertices[o++] = this._normalizeAxis(line.points[i + 1], 1)
                vertices[o++] = this._normalizeAxis(line.points[i + 2], 2)
            }
        }
        this._lineVertices = vertices
    }

    /**
     * Set which electrodes are drawn as highlighted.
     * @param indices - Indices into the field map's channel list.
     */
    setSelectedElectrodes (indices: number[]) {
        this._selected = indices
    }
}
