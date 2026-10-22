/**
 * What the finding picker writes after the finding: the property sets and abbreviations against the real index, the
 * HED string a finding and its properties are stored as and read back from, and what the view fills in.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { loadHedScoreIndex } from '@epicurrents/eeg-module'
import type { HedScoreTermIndex } from '@epicurrents/eeg-module/types'
import { FINDING_GROUPS, hedFindingName, offeredFindings } from '#app/modules/eeg/findings'
import {
    ELECTRODE_REGIONS,
    FINDING_SYNONYMS,
    PROPERTY_SETS,
    canonicalElectrode,
    balanceOf,
    composeFindingCode,
    electrodesByRegion,
    lateralityOf,
    offeredFields,
    parseFindingCode,
    relationsAllowed,
    sensorLaterality,
    sensorsAllowed,
    setBalance,
    setLaterality,
    synonymFindings,
    valueText,
} from '#app/modules/eeg/findingProperties'
import {
    clearFrequencyMeasurements,
    frequencyMeasurementWithin,
    recordFrequencyMeasurement,
} from '#app/views/biosignal/measurements'
import type { HedScorePolicy } from '#app/modules/eeg/types'
import CANONICAL_ELECTRODES from '#app/modules/eeg/canonical-electrodes.json'
import STANDARD_TERMS from '#app/modules/eeg/standard-terms.json'

let index: HedScoreTermIndex

beforeAll(async () => {
    index = await loadHedScoreIndex()
})

const policyFor = (allowedBranches: string[] | null): HedScorePolicy => ({
    allowedBranches,
    schema: { ...index.schema },
})

describe('property sets', () => {
    it('cover every group, and every tag they name is a term that stands on its own', () => {
        expect(Object.keys(PROPERTY_SETS).sort()).toEqual(FINDING_GROUPS.map(group => group.branch).sort())
        for (const [branch, fields] of Object.entries(PROPERTY_SETS)) {
            const offered = offeredFields(index, null, branch)
            // A field the index cannot fill would vanish without a word, so each must resolve.
            expect(offered.map(field => field.key)).toEqual(fields.map(field => field.key))
            for (const field of fields) {
                if (field.kind === 'value') {
                    const term = index.getTerm(field.tag)!
                    expect(term.valueClasses).toContain('numericClass')
                    expect(index.units[term.unitClasses![0]].units).toContain(field.unit)
                    continue
                }
                const standard = new Set(STANDARD_TERMS.terms.map(term => term.name))
                for (const name of (field.terms ?? []).filter(name => !standard.has(name))) {
                    const term = index.getTerm(name)
                    expect(term, name).not.toBeNull()
                    expect(term!.deprecated || term!.requireChild, name).toBeFalsy()
                }
                if (field.under) {
                    expect(index.getTerm(field.under), field.under).not.toBeNull()
                }
            }
        }
    })

    it('resolve a branch of choices to its descendants, without those needing a value', () => {
        const episode = offeredFields(index, null, 'Episode')
        const semiology = episode.find(field => field.key === 'semiology')!
        expect(semiology.kind).toBe('choice')
        const names = semiology.kind === 'choice' ? semiology.options.map(option => option.term.name) : []
        expect(names).toContain('Semiology-automatisms')
        expect(names).toContain('Semiology-oroalimentary')
        expect(names).not.toContain('Semiology-other-automatisms')
        expect(names).not.toContain('Seizure-semiology')
    })

    it('name their options without the words the field already says', () => {
        const labels = (branch: string, key: string) => {
            const field = offeredFields(index, null, branch).find(field => field.key === key)
            return field?.kind === 'choice' ? field.options.map(option => option.label) : []
        }
        const critical = 'Critically-ill-patient-patterns'
        expect(labels(critical, 'duration')).toEqual(['Very brief', 'Brief', 'Intermediate', 'Long', 'Very long'])
        expect(labels(critical, 'morphology')).toEqual(['Spiky', 'Sharp', 'Sharply contoured', 'Blunt'])
        expect(labels(critical, 'onset')).toEqual(['Sudden', 'Gradual'])
        expect(labels(critical, 'superimposed'))
            .toEqual(['Fast activity', 'Rhythmic activity', 'Sharp waves or spikes'])
        expect(labels('Interictal-activity', 'incidence')[0]).toBe('One time')
        expect(labels(critical, 'prevalence')[0]).toBe('Rare')
        expect(labels('Interictal-activity', 'morphology')[0]).toBe('Spike')
    })

    it('offer a checkbox tag beside a choice, written after it and read back', () => {
        const fields = offeredFields(index, null, 'Critically-ill-patient-patterns')
        const morphology = fields.find(field => field.key === 'morphology')!
        expect(morphology.kind === 'choice' && morphology.toggleOption?.term.name).toBe('Triphasic-morphology')
        const code = {
            finding: 'Critically-ill-patient-periodic-discharges',
            properties: ['Triphasic-morphology', 'RPP-sharp'],
            sensors: [],
            values: {},
        }
        const written = composeFindingCode(code, fields)
        expect(written).toBe('(Critically-ill-patient-periodic-discharges, RPP-sharp, Triphasic-morphology)')
        expect(parseFindingCode(written, index)?.properties).toEqual(['RPP-sharp', 'Triphasic-morphology'])
    })

    it('are emptied by a policy that does not allow the property branch', () => {
        const branch = index.schemaBranchOf('Spike')!
        expect(offeredFields(index, policyFor(['Interictal-activity']), 'Interictal-activity')).toEqual([])
        expect(offeredFields(index, policyFor(['Interictal-activity', branch]), 'Interictal-activity').length)
            .toBeGreaterThan(0)
        expect(sensorsAllowed(index, policyFor(['Interictal-activity']))).toBe(false)
        expect(sensorsAllowed(index, policyFor([branch]))).toBe(true)
        expect(sensorsAllowed(index, null)).toBe(true)
    })
})

describe('side', () => {
    const coded = (properties: string[] = []) => ({
        finding: 'Posterior-dominant-rhythm', properties, sensors: [], values: {},
    } as Parameters<typeof lateralityOf>[0])

    it('is offered for every group from the standard tags, symmetry within it', () => {
        for (const group of FINDING_GROUPS) {
            const side = offeredFields(index, null, group.branch).find(field => field.key === 'side')
            expect(side?.kind === 'choice' && side.options.map(option => option.term.name), group.branch)
                .toEqual(['Left', 'Right', 'Symmetrical', 'Asymmetrical'])
        }
        const keys = offeredFields(index, null, 'Background-activity').map(field => field.key)
        expect(keys).not.toContain('symmetry')
    })

    it('writes each choice of the two selects, and reads it back', () => {
        const fields = offeredFields(index, null, 'Background-activity')
        const cases = [
            ['Left', '', 'Left'],
            ['Right', '', 'Right'],
            ['bilateral', '', 'Left, Right'],
            ['bilateral', 'symmetrical', 'Left, Right, Symmetrical'],
            ['bilateral', 'Left', 'Left, Right, Asymmetrical, (Left, (Greater-than, Right))'],
            ['bilateral', 'Right', 'Left, Right, Asymmetrical, (Right, (Greater-than, Left))'],
            ['bilateral', 'asymmetrical', 'Left, Right, Asymmetrical'],
        ] as const
        for (const [laterality, balance, tags] of cases) {
            const code = coded()
            setLaterality(code, laterality)
            setBalance(code, balance)
            const written = composeFindingCode(code, fields)
            expect(written).toBe(`(Posterior-dominant-rhythm, ${tags})`)
            const read = parseFindingCode(written, index)!
            expect([lateralityOf(read), balanceOf(read)]).toEqual([laterality, balance])
        }
    })

    it('is read off the electrodes, midline ones taking no side', () => {
        expect(sensorLaterality(['F7', 'T7', 'Cz'])).toBe('Left')
        expect(sensorLaterality(['F8', 'TP10', 'A2'])).toBe('Right')
        expect(sensorLaterality(['F7', 'F8'])).toBe('bilateral')
        expect(sensorLaterality(['Fz', 'Cz', 'Pz', 'Nz'])).toBe('')
        expect(sensorLaterality([])).toBe('')
        expect(sensorLaterality(['M1'])).toBe('Left')
    })

    it('drops the balance on leaving bilateral and keeps it on staying', () => {
        const code = coded()
        setLaterality(code, 'bilateral')
        setBalance(code, 'Left')
        setLaterality(code, 'bilateral')
        expect(balanceOf(code)).toBe('Left')
        setLaterality(code, 'Right')
        expect(code.properties).toEqual(['Right'])
        expect(code.dominantSide).toBeUndefined()
        setBalance(code, 'symmetrical')
        expect(code.properties).toEqual(['Right'])
    })

    it('is not read back in shapes the selects do not write', () => {
        for (const tags of [
            'Left, Symmetrical',
            'Left, Right, Symmetrical, Asymmetrical',
            'Left, Right, (Left, (Greater-than, Right))',
            'Left, Right, Symmetrical, (Left, (Greater-than, Right))',
        ]) {
            expect(parseFindingCode(`(Posterior-dominant-rhythm, ${tags})`, index), tags).toBeNull()
        }
    })

    it('follows the property branch under a policy', () => {
        const withoutProperty = offeredFields(index, policyFor(['Background-activity']), 'Background-activity')
        expect(withoutProperty.map(field => field.key)).not.toContain('side')
    })
})

describe('dominance', () => {
    const fields = () => offeredFields(index, null, 'Interictal-activity')
    const bilateral = {
        finding: 'Epileptiform-interictal-activity',
        properties: ['Left', 'Right'],
        sensors: ['F7', 'T7', 'T8'],
        values: {},
    }

    it('writes the dominant side and the maximum with the standard comparison, and reads them back', () => {
        const code = {
            ...bilateral,
            dominantSide: 'Left' as const,
            maxSensors: ['T7'],
            properties: ['Left', 'Right', 'Asymmetrical'],
        }
        const written = composeFindingCode(code, fields())
        expect(written).toBe(
            '(Epileptiform-interictal-activity, Left, Right, Asymmetrical, (Left, (Greater-than, Right)), '
            + 'Sensor-list/F7;T7;T8, '
            + '(Sensor-list/T7, (Greater-than, Sensor-list/F7;T8)))'
        )
        expect(parseFindingCode(written, index)).toEqual(code)
        expect(hedFindingName(written)).toBe('Epileptiform interictal activity')
    })

    it('writes neither without what it compares', () => {
        const oneSide = { ...bilateral, dominantSide: 'Left' as const, properties: ['Left'] }
        expect(composeFindingCode(oneSide, fields())).not.toContain('Greater-than')
        const wholeLocation = { ...bilateral, maxSensors: ['F7', 'T7', 'T8'] }
        expect(composeFindingCode(wholeLocation, fields())).not.toContain('Greater-than')
    })

    it('is not read back in shapes the picker does not write', () => {
        const refused = [
            // A dominant side without both sides chosen.
            'Left, Asymmetrical, (Left, (Greater-than, Right))',
            // A maximum that does not split the location exactly.
            'Sensor-list/F7;T7, (Sensor-list/T7, (Greater-than, Sensor-list/F7;T8))',
            'Sensor-list/F7;T7;T8, (Sensor-list/T7, (Greater-than, Sensor-list/F7))',
            'Sensor-list/F7;T7, (Sensor-list/T7, (Greater-than, Sensor-list/T7;F7))',
            // Another comparison, or the same side on both ends.
            'Left, Right, Asymmetrical, (Left, (Less-than, Right))',
            'Left, Right, Asymmetrical, (Left, (Greater-than, Left))',
            // Two of a kind.
            'Left, Right, Asymmetrical, (Left, (Greater-than, Right)), (Right, (Greater-than, Left))',
        ]
        for (const tags of refused) {
            expect(parseFindingCode(`(Epileptiform-interictal-activity, ${tags})`, index), tags).toBeNull()
        }
    })
})

describe('abbreviations', () => {
    it('each stand for an offered finding and properties of its group', () => {
        const offered = offeredFindings(index, null)
        for (const synonym of FINDING_SYNONYMS) {
            for (const abbreviation of synonym.abbreviations) {
                const found = synonymFindings(offered, abbreviation, index, null)
                expect(found.map(finding => finding.term.name), abbreviation).toContain(synonym.finding)
            }
        }
    })

    it('match whole and in any case, carrying their properties', () => {
        const offered = offeredFindings(index, null)
        const [firda] = synonymFindings(offered, 'firda', index, null)
        expect(firda.term.name).toBe('Abnormal-interictal-rhythmic-activity')
        expect(firda.abbreviation).toBe('FIRDA')
        expect(firda.properties).toEqual(['Frontal-intermittent-rhythmic-delta-activity'])
        expect(synonymFindings(offered, 'fir', index, null)).toEqual([])
        expect(synonymFindings(offered, '  ', index, null)).toEqual([])
    })

    it('name slowing by its irregular delta and theta, and polymorphic delta by its own keyword', () => {
        const offered = offeredFindings(index, null)
        for (const typed of ['slowing', 'Focal slowing', 'generalized slowing', 'slow']) {
            const [found] = synonymFindings(offered, typed, index, null)
            expect(found.term.name, typed).toBe('Abnormal-interictal-rhythmic-activity')
            expect(found.properties).toEqual(['Irregular-delta-or-theta-activity'])
        }
        expect(synonymFindings(offered, 'PDA', index, null)[0].properties).toEqual(['Polymorphic-delta-activity'])
    })

    it('are dropped when the policy refuses a property they set', () => {
        const offered = offeredFindings(index, policyFor(['Interictal-activity']))
        expect(synonymFindings(offered, 'FIRDA', index, policyFor(['Interictal-activity']))).toEqual([])
        expect(synonymFindings(offered, 'LPD', index, policyFor(['Interictal-activity'])).length).toBe(1)
    })
})

describe('finding strings', () => {
    it('write a bare finding as its tag, and properties as one group with the finding first', () => {
        const fields = offeredFields(index, null, 'Interictal-activity')
        const bare = { finding: 'Epileptiform-interictal-activity', properties: [], sensors: [], values: {} }
        expect(composeFindingCode(bare, fields)).toBe('Epileptiform-interictal-activity')
        const full = {
            finding: 'Epileptiform-interictal-activity',
            properties: ['Frequent-feature-incidence', 'Spike-and-slow-wave'],
            sensors: ['F7', 'T7'],
            values: { 'Feature-frequency': { mode: 'exact' as const, value: 3 } },
        }
        const written = composeFindingCode(full, fields)
        // Field order, not the order of picking: morphology before incidence, values after properties.
        expect(written).toBe(
            '(Epileptiform-interictal-activity, Spike-and-slow-wave, Frequent-feature-incidence, '
            + 'Feature-frequency/3 Hz, Sensor-list/F7;T7)'
        )
        expect(parseFindingCode(written, index)).toEqual({
            ...full,
            properties: ['Spike-and-slow-wave', 'Frequent-feature-incidence'],
        })
        expect(hedFindingName(written)).toBe('Epileptiform interictal activity')
    })

    it('read back a bare tag and a string no field wrote unchanged', () => {
        expect(parseFindingCode('Spike-or-sharp-and-wave', index)).toEqual({
            finding: 'Spike-or-sharp-and-wave', properties: [], sensors: [], values: {},
        })
        const foreign = '(Posterior-dominant-rhythm, Eye-blink-artifact)'
        const parsed = parseFindingCode(foreign, index)!
        expect(composeFindingCode(parsed, offeredFields(index, null, 'Background-activity'))).toBe(foreign)
    })

    it('refuse strings the picker did not write', () => {
        expect(parseFindingCode('(Spike, (Sharp-wave, Spike))', index)).toBeNull()
        expect(parseFindingCode('Not-a-term', index)).toBeNull()
        expect(parseFindingCode('(Spike, Not-a-term)', index)).toBeNull()
        expect(parseFindingCode('Line-noise-artifact/50 Hz', index)).toBeNull()
        expect(parseFindingCode('(Spike, Feature-frequency/3 kHz)', index)).toBeNull()
        expect(parseFindingCode('(Spike, Feature-frequency/fast)', index)).toBeNull()
        // Each would be written differently by the next write: a location dropped, a tag once, an empty entry gone.
        expect(parseFindingCode('(Spike, Sensor-list/F7, Sensor-list/T7)', index)).toBeNull()
        expect(parseFindingCode('(Spike, Spike-and-slow-wave, Spike-and-slow-wave)', index)).toBeNull()
        expect(parseFindingCode('(Spike, Sensor-list/F7;;T7)', index)).toBeNull()
    })
})

describe('values', () => {
    const fields = () => offeredFields(index, null, 'Interictal-activity')
    const coded = (value: Parameters<typeof valueText>[0]) => ({
        finding: 'Epileptiform-interictal-activity',
        properties: [],
        sensors: [],
        values: { 'Feature-frequency': value },
    })

    it('write each mode with its comparison, and read it back', () => {
        const cases = [
            [{ mode: 'exact', value: 3 }, 'Feature-frequency/3 Hz'],
            [{ mode: 'min', value: 2 }, '(Greater-than-or-equal-to, Feature-frequency/2 Hz)'],
            [{ mode: 'max', value: 4 }, '(Less-than-or-equal-to, Feature-frequency/4 Hz)'],
            [{ mode: 'about', value: 3.5 }, '(Approximately-equal-to, Feature-frequency/3.5 Hz)'],
            [
                { mode: 'range', upper: 3, value: 2 },
                '(Greater-than-or-equal-to, Feature-frequency/2 Hz), (Less-than-or-equal-to, Feature-frequency/3 Hz)',
            ],
        ] as const
        for (const [value, tags] of cases) {
            const written = composeFindingCode(coded(value), fields())
            expect(written).toBe(`(Epileptiform-interictal-activity, ${tags})`)
            expect(parseFindingCode(written, index)?.values['Feature-frequency']).toEqual(value)
            expect(hedFindingName(written)).toBe('Epileptiform interictal activity')
        }
    })

    it('write a range missing its upper bound as its lower bound', () => {
        expect(composeFindingCode(coded({ mode: 'range', value: 2 }), fields()))
            .toBe('(Epileptiform-interictal-activity, (Greater-than-or-equal-to, Feature-frequency/2 Hz))')
    })

    it('are not read back from comparisons the picker does not write', () => {
        const refused = [
            '(Greater-than, Feature-frequency/2 Hz)',
            '(Less-than, Feature-frequency/2 Hz)',
            '(Equal-to, Feature-frequency/2 Hz)',
            '(Not-equal-to, Feature-frequency/2 Hz)',
            '(Greater-than-or-equal-to, Feature-frequency/3 Hz), (Less-than-or-equal-to, Feature-frequency/2 Hz)',
            '(Greater-than-or-equal-to, Feature-frequency/2 Hz), (Greater-than-or-equal-to, Feature-frequency/3 Hz)',
            'Feature-frequency/2 Hz, (Less-than-or-equal-to, Feature-frequency/3 Hz)',
            '(Approximately-equal-to, Spike)',
            '(Approximately-equal-to, Feature-frequency/2 Hz, Spike)',
        ]
        for (const tags of refused) {
            expect(parseFindingCode(`(Epileptiform-interictal-activity, ${tags})`, index), tags).toBeNull()
        }
    })

    it('read as the reader writes them', () => {
        expect(valueText({ mode: 'exact', value: 3 }, 'Hz')).toBe('3 Hz')
        expect(valueText({ mode: 'about', value: 3 }, 'Hz')).toBe('≈ 3 Hz')
        expect(valueText({ mode: 'min', value: 3 })).toBe('≥ 3')
        expect(valueText({ mode: 'range', upper: 3, value: 2 }, 'Hz')).toBe('2–3 Hz')
    })

    it('allow comparisons only where the policy allows the relation branch', () => {
        expect(relationsAllowed(null)).toBe(true)
        expect(relationsAllowed(policyFor(['Interictal-activity']))).toBe(false)
        expect(relationsAllowed(policyFor(['Interictal-activity', 'Relation']))).toBe(true)
    })
})

describe('frequency measurements', () => {
    it('are offered for an annotation covering the measured span, the latest first', () => {
        clearFrequencyMeasurements()
        recordFrequencyMeasurement({ max: 3.2, mean: 3, min: 2.8, range: [10, 12] })
        recordFrequencyMeasurement({ max: 6, mean: 5, min: 4, range: [10.5, 11] })
        expect(frequencyMeasurementWithin(10, 12)?.mean).toBe(5)
        expect(frequencyMeasurementWithin(9, 11)?.mean).toBe(5)
        expect(frequencyMeasurementWithin(11, 12)).toBeNull()
        recordFrequencyMeasurement({ max: 3.4, mean: 3.1, min: 2.9, range: [10, 12] })
        expect(frequencyMeasurementWithin(10, 12)?.mean).toBe(3.1)
        // An annotation's end is its start plus its duration, which floating point can put just short of the span's.
        recordFrequencyMeasurement({ max: 2, mean: 2, min: 2, range: [0.2, 0.9] })
        expect(0.2 + (0.9 - 0.2)).toBeLessThan(0.9)
        expect(frequencyMeasurementWithin(0.2, 0.2 + (0.9 - 0.2))?.mean).toBe(2)
        clearFrequencyMeasurements()
    })
})

describe('what the view fills in', () => {
    it('names electrodes by their canonical labels only', () => {
        expect(canonicalElectrode('fp1')).toBe('Fp1')
        expect(canonicalElectrode('FPZ')).toBe('Fpz')
        expect(canonicalElectrode('t3')).toBe('T7')
        expect(canonicalElectrode('f7-t7')).toBe('F7')
        expect(canonicalElectrode('ekg')).toBeNull()
        expect(canonicalElectrode('')).toBeNull()
    })

    it('lists every canonical electrode under exactly one region', () => {
        const placed = ELECTRODE_REGIONS.flatMap(region => region.electrodes)
        expect(new Set(placed).size).toBe(placed.length)
        expect([...placed].sort()).toEqual([...CANONICAL_ELECTRODES.electrodes].sort())
    })

    it('groups the offered electrodes by region, in region order, the unplaced last', () => {
        expect(electrodesByRegion(['O1', 'T7', 'Fp1', 'P7', 'Cz', 'X1'])).toEqual([
            { electrodes: ['Fp1'], label: 'Frontal' },
            { electrodes: ['T7'], label: 'Temporal' },
            { electrodes: ['Cz'], label: 'Central' },
            { electrodes: ['P7', 'O1'], label: 'Parieto-occipital' },
            { electrodes: ['X1'], label: 'Other' },
        ])
    })
})
