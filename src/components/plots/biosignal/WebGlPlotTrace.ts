/**
 * WebGL plot trace line.
 * @package    epicurrents/interface
 * @copyright  2021 Sampsa Lohi
 * @license    Apache-2.0
 */

import type {
    BiosignalPlot,
    WebGlCompatibleColor,
    WebGlTrace,
    WebGlTraceColorSegment
} from '#types/plot'
import { Log } from 'scoped-event-log'

const SCOPE = 'WebGlPlotTrace'

export default class WebGlPlotTrace implements WebGlTrace {
    protected _buffer = 0 as WebGLBuffer
    protected _color: WebGlCompatibleColor
    protected _colorSegments: WebGlTraceColorSegment[] | null = null
    protected _coordinates = 0
    protected _downsampleFactor = 0
    protected _offset: number
    protected _opacity: number | undefined = undefined
    protected _parent: BiosignalPlot
    protected _pointCount = 0
    protected _polarity: 1 | -1
    protected _render = true
    protected _samplesPerPx: number
    protected _samplingRate: number
    protected _scale = 0
    protected _sensitivity: number
    protected _viewRange = 0
    protected _xyPairs: Float32Array = new Float32Array()


    get scale () {
        return this._scale
    }
    set scale (value: number) {
        this._scale = value
    }
    get buffer () {
        return this._buffer
    }
    set buffer (buffer: WebGLBuffer) {
        this._buffer = buffer
    }
    get color () {
        return this._color
    }
    get colorSegments () {
        return this._colorSegments
    }
    set colorSegments (value: WebGlTraceColorSegment[] | null) {
        // Keep the segments sorted by start index so the renderer can walk them
        // left-to-right without re-sorting on every frame. Copy first so the
        // caller's array is not mutated.
        this._colorSegments = value?.length ? [...value].sort((a, b) => a.start - b.start) : null
    }
    get coordinates () {
        return this._coordinates
    }
    set coordinates (coords: number) {
        this._coordinates = coords
    }
    get length () {
        return this._xyPairs.length/2
    }
    get offset () {
        return this._offset
    }
    get opacity () {
        return this._opacity
    }
    get pointCount () {
        return this._pointCount
    }
    set opacity (value: number | undefined) {
        this._opacity = value
    }
    get polarity () {
        return this._polarity
    }
    set polarity (value: 1 | -1) {
        this._polarity = value
    }
    get render () {
        return this._render
    }
    get samplingRate () {
        return this._samplingRate
    }
    get sensitivity () {
        return this._sensitivity
    }
    set sensitivity (value: number) {
        this._sensitivity = value
    }
    get xy () {
        return this._xyPairs
    }

    /**
     * @param viewRange - Duration in seconds that the plot width spans. When given (and the sampling rate is known), datapoints are positioned by their time within the view; otherwise they are spread evenly over `length`.
     */
    constructor (
        parent: BiosignalPlot,
        color: WebGlCompatibleColor,
        length: number,
        sensitivity: number,
        samplingRate: number,
        samplesPerPx: number,
        downsampleFactor: number,
        polarity: 1 | -1,
        scale: number,
        offset: number,
        viewRange = 0,
    ) {
        this._color = color
        this._downsampleFactor = downsampleFactor
        this._offset = offset
        this._parent = parent
        this._polarity = polarity
        this._samplesPerPx = samplesPerPx
        this._samplingRate = samplingRate
        this._sensitivity = sensitivity
        this._scale = scale
        this._viewRange = viewRange
        this._xyPairs = new Float32Array(
            2*Math.floor(
                Math.max(0, length)
            )
        )
        this.initData()
    }

    getData () {
        return this._xyPairs.filter((_value: number, index: number) => (index%2))
    }

    initData (length = this.length, step: number = 1) {
        // WebGL canvas clip space dimensions are always -1 to 1.
        // Position each datapoint by the TIME it represents: its offset from the view start as a
        // fraction of the view duration. Normalising over the datapoint count instead is only
        // equivalent when the points exactly span the view, and the residual is one sample period
        // — negligible at high sampling rates but a large share of the width at low ones (a 1 Hz
        // channel over a 10 s view would stretch its 10 points across the whole width).
        // Without a known view duration, fall back to spreading the points evenly.
        const clipSpaceStep = (this._viewRange > 0 && this._samplingRate > 0)
                              ? 2*(this._downsampleFactor/this._samplingRate)/this._viewRange
                              : 2/length
        // Initialize the array with the given step, i.e. set x-values to be `step` apart.
        // Points past the view edge keep their true (out of range) x and are clipped by WebGL.
        for (let i=0; i<length; i++) {
            this._xyPairs[i*2] = (i*step)*clipSpaceStep - 1
            this._xyPairs[i*2 + 1] = 0
        }
        this._pointCount = length
    }

    setData (data: Float32Array | number, downsampleFactor = this._downsampleFactor) {
        if (typeof data === 'number') {
            // Set all datapoints to same value.
            for (let i=0; i<this.length; i++) {
                this._xyPairs[i*2 + 1] = data
            }
            this._pointCount = this.length
            return
        }
        const dataLoop = Math.floor(Math.min(data.length/downsampleFactor, this.length))
        for (let i=0; i<dataLoop; i++) {
            this._xyPairs[i*2 + 1] = data[i*downsampleFactor]
        }
        // Points beyond the available data are not drawn (see `pointCount`); zero them so a
        // previous frame's values cannot surface if a consumer ignores the count.
        for (let j=dataLoop; j<this.length; j++) {
            this._xyPairs[j*2 + 1] = 0
        }
        this._pointCount = dataLoop
    }

    setSensitivity (value: number) {
        if (value <= 0) {
            Log.error(`Sensitivity must be greater than zero, ${value} was given.`, SCOPE)
            return
        }
        this._sensitivity = value
    }
}
