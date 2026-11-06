import { describe, expect, it } from 'vitest'
import { traceRange } from '../src/util/trace-range'
import WebGlPlot from '../src/components/plots/biosignal/WebGlPlot'

const offset = { baseline: 0.3, bottom: 0.2, top: 0.4 }
/** Where `value` is drawn under `range`, as a fraction of the plot height from its bottom. */
const drawnAt = (range: Parameters<typeof WebGlPlot.rangeTransform>[0], value: number) => {
    const [scale, shift] = WebGlPlot.rangeTransform(range)
    return (scale*value + shift + 1)/2
}

describe('range mode', () => {
    it('draws a channel without a display range by sensitivity', () => {
        expect(traceRange({ displayRange: null, offset })).toBeNull()
        expect(traceRange({ offset } as never)).toBeNull()
        expect(traceRange({ displayRange: [5, 5], offset })).toBeNull()
    })

    it('spans the band of the channel with its range, lower value at the bottom', () => {
        const range = traceRange({ displayRange: [50, 100], offset })!
        expect(range).toEqual({ bottom: 0.2, top: 0.4, values: [50, 100] })
        expect(drawnAt(range, 50)).toBeCloseTo(0.2, 10)
        expect(drawnAt(range, 100)).toBeCloseTo(0.4, 10)
        expect(drawnAt(range, 75)).toBeCloseTo(0.3, 10)
    })

    it('places a range that is not centred on zero, as an ECG one is', () => {
        // An ECG in volts with more room above the isoelectric line than below it.
        const range = traceRange({ displayRange: [-0.5e-3, 1.5e-3], offset })!
        expect(drawnAt(range, 0)).toBeCloseTo(0.25, 10)
        expect(drawnAt(range, 1.5e-3)).toBeCloseTo(0.4, 10)
    })
})
