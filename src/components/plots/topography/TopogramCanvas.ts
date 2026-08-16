/**
 * 2D canvas view of a scalp voltage field topogram.
 *
 * The field is computed by `EegTopogram`, which fills a square RGBA buffer; this class puts that buffer on a canvas and
 * adds everything that makes it readable — contours, the head outline that carries the orientation, and the electrode
 * markers.
 *
 * The disc is inset rather than filling the canvas because the nose, the ears and part of the outer electrode ring
 * project beyond the head circle. That is not an artefact of this projection: a 10-20 montage in head coordinates has
 * no circle radius that contains all of it, and MNE's own topomaps overflow further than these do.
 *
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { EegTopogramInterface, DivergingRamp } from '@epicurrents/eeg-module/types'
import type { TopogramCanvasOptions } from '#types/plot'

/** Largest fraction of the canvas the head disc may fill, when nothing needs room outside it. */
const MAX_INSET = 0.86
/** Smallest it may shrink to, so one stray electrode cannot reduce the field to a token disc. */
const MIN_INSET = 0.55
/** Fraction of the canvas half-width the outermost marker is placed at. */
const MARKER_MARGIN = 0.96

const DEFAULT_OPTIONS = {
    activeElectrodeColor: 'rgb(255, 217, 38)',
    activeElectrodeEdgeColor: 'rgba(40, 34, 0, 0.9)',
    contourColor: 'rgba(255, 255, 255, 0.55)',
    electrodeColor: 'rgba(20, 22, 28, 0.8)',
    // The outer ring of a 10-20 montage lands beyond the head circle, so a marker has to read on the
    // panel background as well as on the field: a dark fill carries the one, a light edge the other.
    electrodeEdgeColor: 'rgba(255, 255, 255, 0.8)',
    // The head circle, nose and ears are drawn largely outside the coloured disc, on whatever the
    // surrounding panel happens to be, so a fixed colour is only ever right for one theme. Taking
    // the inherited text colour is the canvas equivalent of `currentColor` and follows the theme.
    outlineColor: 'currentColor',
}
/** Opacity of the head circle, nose and ears. Low enough not to compete with the field, high enough to survive a light theme. */
const OUTLINE_ALPHA = 0.5

export default class TopogramCanvas {
    protected _buffer: HTMLCanvasElement
    protected _canvas: HTMLCanvasElement
    protected _electrodes: { radius: number, x: number, y: number }[]
    protected _image: ImageData | null = null
    /** Fraction of the canvas the head disc fills, chosen to keep every marker on the canvas. */
    protected _inset: number
    protected _options: typeof DEFAULT_OPTIONS
    protected _selected: boolean[] = []
    protected _topogram: EegTopogramInterface

    /**
     * @param canvas - Canvas to draw on. Its own pixel dimensions decide the drawn size.
     * @param topogram - Topogram supplying the field and the electrode projection.
     * @param options - Colour overrides.
     */
    constructor (canvas: HTMLCanvasElement, topogram: EegTopogramInterface, options?: TopogramCanvasOptions) {
        this._canvas = canvas
        this._topogram = topogram
        this._options = { ...DEFAULT_OPTIONS, ...(options ?? {}) }
        this._electrodes = topogram.electrodePixels()
        // How far the outermost electrode reaches decides how large the disc can be. A 10-20 montage
        // needs room for the frontopolar pair at 1.22 head radii; a 10-10 montage adds the inferior
        // ring — F9/F10, T9/T10, P9/P10, Iz — which reaches past 1.5, and at a fixed inset those
        // markers fall off the canvas entirely, which reads as a montage missing eight electrodes.
        const reach = this._electrodes.reduce((max, electrode) => Math.max(max, electrode.radius), 1)
        this._inset = Math.min(MAX_INSET, Math.max(MIN_INSET, MARKER_MARGIN/reach))
        this._buffer = document.createElement('canvas')
        this._buffer.width = topogram.resolution
        this._buffer.height = topogram.resolution
        const context = this._buffer.getContext('2d')
        if (context) {
            this._image = context.createImageData(topogram.resolution, topogram.resolution)
        }
    }

    /**
     * Draw one frame.
     * @param values - One voltage per electrode, in the topogram's own channel order.
     * @param limit - Voltage mapped to full saturation.
     * @param contours - Number of contour levels either side of zero; 0 draws none.
     * @param ramp - Diverging colour ramp.
     */
    draw (values: ArrayLike<number>, limit: number, contours: number, ramp: DivergingRamp) {
        const context = this._canvas.getContext('2d')
        const bufferContext = this._buffer.getContext('2d')
        if (!context || !bufferContext || !this._image) {
            return
        }
        this._topogram.toRgba(values, this._image.data, limit, ramp)
        bufferContext.putImageData(this._image, 0, 0)
        const size = this._canvas.width
        const diameter = size*this._inset
        const offset = (size - diameter)/2
        const scale = diameter/this._topogram.resolution
        context.clearRect(0, 0, size, this._canvas.height)
        context.drawImage(this._buffer, offset, offset, diameter, diameter)
        if (contours > 0) {
            this._drawContours(context, values, limit, contours, offset, scale)
        }
        this._drawOutline(context, size, diameter/2)
        this._drawElectrodes(context, size, offset, scale)
    }

    protected _drawContours (
        context: CanvasRenderingContext2D,
        values: ArrayLike<number>,
        limit: number,
        contours: number,
        offset: number,
        scale: number,
    ) {
        context.save()
        context.translate(offset, offset)
        context.scale(scale, scale)
        context.strokeStyle = this._options.contourColor
        context.lineWidth = 1/scale
        context.beginPath()
        // Segments are unordered, so each is stroked as an independent line rather than as a path.
        for (const line of this._topogram.isolines(values, contours, limit)) {
            for (let i = 0; i < line.points.length; i += 4) {
                context.moveTo(line.points[i], line.points[i + 1])
                context.lineTo(line.points[i + 2], line.points[i + 3])
            }
        }
        context.stroke()
        context.restore()
    }

    /**
     * Draw the electrode markers, the selected ones highlighted.
     *
     * Positions come from the topogram's own forward projection, so a marker sits over the field its electrode
     * produced. Taking them from a layout table instead would put each marker a few pixels off the data it labels.
     */
    protected _drawElectrodes (
        context: CanvasRenderingContext2D,
        size: number,
        offset: number,
        scale: number,
    ) {
        const plain = Math.max(1.5, size/150)
        const active = Math.max(3, size/70)
        context.save()
        context.lineWidth = Math.max(1, size/300)
        for (let i = 0; i < this._electrodes.length; i++) {
            const electrode = this._electrodes[i]
            const selected = this._selected[i]
            context.beginPath()
            context.arc(
                offset + electrode.x*scale, offset + electrode.y*scale,
                selected ? active : plain, 0, Math.PI*2
            )
            context.fillStyle = selected ? this._options.activeElectrodeColor : this._options.electrodeColor
            context.strokeStyle = selected
                                  ? this._options.activeElectrodeEdgeColor
                                  : this._options.electrodeEdgeColor
            context.fill()
            context.stroke()
        }
        context.restore()
    }

    /**
     * Draw the head circle, the nose and the ears.
     *
     * These are the orientation key for a projection that is otherwise rotationally ambiguous, and they are drawn
     * heavier and brighter than the contours on purpose: a nose that reads as an isopotential is worse than no nose.
     */
    protected _drawOutline (context: CanvasRenderingContext2D, size: number, radius: number) {
        const cx = size/2
        const cy = size/2
        context.save()
        context.strokeStyle = this._resolveColor(this._options.outlineColor)
        context.globalAlpha = OUTLINE_ALPHA
        context.lineWidth = Math.max(1.5, size/120)
        context.lineJoin = 'round'
        context.lineCap = 'round'
        context.beginPath()
        context.arc(cx, cy, radius, 0, Math.PI*2)
        context.stroke()
        context.beginPath()
        context.moveTo(cx - radius*0.11, cy - radius*0.994)
        context.lineTo(cx, cy - radius*1.16)
        context.lineTo(cx + radius*0.11, cy - radius*0.994)
        context.stroke()
        for (const side of [-1, 1]) {
            context.beginPath()
            context.moveTo(cx + side*radius*0.995, cy - radius*0.18)
            context.bezierCurveTo(
                cx + side*radius*1.09, cy - radius*0.20,
                cx + side*radius*1.09, cy + radius*0.14,
                cx + side*radius*0.995, cy + radius*0.16,
            )
            context.stroke()
        }
        context.restore()
    }

    /**
     * Resolve a colour option, standing in for CSS `currentColor`, which a canvas context does not understand.
     *
     * Read at draw time rather than cached, so a theme switch is picked up by the next frame.
     * @param color - Any CSS colour, or the literal `currentColor`.
     */
    protected _resolveColor (color: string) {
        if (color !== 'currentColor') {
            return color
        }
        return getComputedStyle(this._canvas).color || '#888'
    }

    /**
     * Set which electrodes are drawn as highlighted.
     * @param indices - Indices into the topogram's own channel order.
     */
    setSelectedElectrodes (indices: number[]) {
        const selected = new Set(indices)
        this._selected = this._electrodes.map((_electrode, index) => selected.has(index))
    }
}
