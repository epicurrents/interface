/**
 * What the finding picker writes after the finding itself: the optional properties offered per group, the
 * abbreviations readers search by, and the HED string a finding and its properties are stored as.
 *
 * The property sets and the abbreviations are ours, not the schema's: its `suggestedTag` attributes are too sparse to
 * drive a form. A finding with properties is stored as one group, `(Finding, Property, …, Sensor-list/F7;T7)`, with
 * the finding first so it names the event, and a bare finding as its tag alone. Only what the platform's validator
 * accepts is ever written: property tags standing on their own, numbers in numeric placeholders, and canonical
 * electrode labels in `Sensor-list`. Onset and duration belong to the event and are never written; the critical-care
 * duration category is the length of the whole pattern, which an annotation drawn on one discharge does not show, so
 * the reader gives it.
 *
 * A number is exact, a bound, approximate or a range. SCORE has no range tag, so the bounds are written with the HED
 * standard's comparison tags, one group per bound: `(Greater-than-or-equal-to, Feature-frequency/2 Hz)`. The schema
 * has strict and inequality comparisons too, which the picker does not write; a string carrying one is not read back,
 * since rewriting it as one of these forms would change what it says.
 *
 * A dominance is written with the standard's `Greater-than`, which reads `(A, (Greater-than, B))` as A being greater
 * than B: `(Left, (Greater-than, Right))` for a bilateral finding greater on the left, and `(Sensor-list/T7,
 * (Greater-than, Sensor-list/F7;TP7))` for the electrodes a finding is greatest at against the rest of its location.
 * What is greater is the finding itself; naming its amplitude would take `Feature-amplitude`, which needs a number. The
 * location keeps listing every electrode, so a reader who does not follow the relation still has the whole field.
 *
 * Side and symmetry are tags of the HED standard rather than of SCORE, so the term index does not hold them. They come
 * from `standard-terms.json`, a copy taken from the plugin's vendored schema and pinned to it by the plugin's tests.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { HedScoreTerm, HedScoreTermIndex } from '@epicurrents/eeg-module/types'
import type { HedScorePolicy } from './types'
import type { OfferedFinding } from './findings'
import { findingLabel } from './findings'
import CANONICAL_ELECTRODES from './canonical-electrodes.json'
import STANDARD_TERMS from './standard-terms.json'

/** A property the reader picks from a list of tags. */
export type ChoiceField = {
    /**
     * Offer the field only after these findings, the findings under them, and the more general findings above them,
     * which may be any of them; after every finding of the set when not given.
     */
    findings?: string[]
    /** A heading shown before the field, opening a part of the set that applies to fewer findings. */
    heading?: string
    /** Stable key of the field within its set. */
    key: string
    kind: 'choice'
    /** Field name shown to the reader. */
    label: string
    /** The reader may pick more than one. */
    multiple?: boolean
    /** The tags offered, in this order. */
    terms?: string[]
    /**
     * Words left out of the options' names because the field's own name says them: under "Duration", the schema's
     * `Very-brief-RPP-duration` reads as "Very brief". The stored tag is unchanged.
     */
    omit?: string[]
    /** What the field says while nothing is chosen, in place of the select's own prompt. */
    placeholder?: string
    /** A tag that may be added to whatever the field chooses, offered as a checkbox beside it with its own label. */
    toggle?: { label: string, tag: string }
    /** Offer every tag under this one that stands on its own, in schema order; used when `terms` is not given. */
    under?: string
}

/** A property the reader gives a number for, written as `Tag/<number> <unit>`. */
export type ValueField = {
    findings?: string[]
    heading?: string
    key: string
    kind: 'value'
    label: string
    /** The tag, whose placeholder takes a number. */
    tag: string
    /** The unit the number is written in. */
    unit: string
}

export type PropertyField = ChoiceField | ValueField

/** A field as offered under a policy, its choices resolved to terms. */
export type OfferedField =
    | ChoiceField & {
        options: { label: string, term: HedScoreTerm }[]
        /** The field's checkbox tag, when it has one the policy allows. */
        toggleOption?: { label: string, term: HedScoreTerm }
    }
    | ValueField

/** A finding and its properties, as the picker edits them. */
export type FindingCode = {
    /** The finding's short-form tag. */
    finding: string
    /** Property tags, standing on their own. */
    properties: string[]
    /** Canonical electrode labels of the finding's location. */
    sensors: string[]
    /** The side a bilateral finding is greater on; written only when both sides are among the properties. */
    dominantSide?: Side
    /** The location's electrodes the finding is greatest at; written only when they are some of the location. */
    maxSensors?: string[]
    /** Numbers of the value fields, by tag. */
    values: Record<string, FindingValue>
}

/** A side of the head, as the HED standard names it. */
export type Side = 'Left' | 'Right'

/** Where a finding is: on one side, on both, or not given. */
export type Laterality = '' | Side | 'bilateral'

/** How a bilateral finding is balanced: symmetrical, greater on one side, asymmetrical without a side, or not given. */
export type Balance = '' | Side | 'asymmetrical' | 'symmetrical'

/** How a value field's number is meant. */
export type ValueMode = 'about' | 'exact' | 'max' | 'min' | 'range'

/** A value field's number, or a range of two. */
export type FindingValue = {
    mode: ValueMode
    /** The number; the lower bound of a range. */
    value: number
    /** The upper bound of a range. */
    upper?: number
}

/** An abbreviation and the finding, with any properties, it stands for. */
export type FindingSynonym = {
    abbreviations: string[]
    finding: string
    properties?: string[]
}

/** Value modes in the order they are offered, each with the comparison tag it is written with. */
export const VALUE_MODES: { mode: ValueMode, relation: string | null, symbol: string, title: string }[] = [
    { mode: 'exact', relation: null, symbol: '=', title: 'Exactly' },
    { mode: 'min', relation: 'Greater-than-or-equal-to', symbol: '≥', title: 'At least' },
    { mode: 'max', relation: 'Less-than-or-equal-to', symbol: '≤', title: 'At most' },
    { mode: 'about', relation: 'Approximately-equal-to', symbol: '≈', title: 'About' },
    { mode: 'range', relation: null, symbol: '–', title: 'Range' },
]

/** The HED standard's branch the comparison tags sit under, which a branch policy has to allow for any but `exact`. */
export const RELATION_BRANCH = 'Relation'

const GREATER_RELATION = 'Greater-than'
const MIN_RELATION = 'Greater-than-or-equal-to'
const MAX_RELATION = 'Less-than-or-equal-to'
const ABOUT_RELATION = 'Approximately-equal-to'

/** The location tag; its value lists canonical electrode labels separated by `;`. */
export const SENSOR_LIST = 'Sensor-list'

const SENSOR_SEPARATOR = ';'

const INCIDENCE: ChoiceField = {
    key: 'incidence', kind: 'choice', label: 'Incidence', omit: ['feature', 'incidence'], under: 'Feature-incidence',
}
const PREVALENCE: ChoiceField = {
    key: 'prevalence', kind: 'choice', label: 'Prevalence', omit: ['prevalence'], under: 'Feature-prevalence',
}
const FREQUENCY: ValueField = {
    key: 'frequency', kind: 'value', label: 'Frequency', tag: 'Feature-frequency', unit: 'Hz',
}
/** The two sides; both chosen together mean bilateral. */
export const SIDES: Side[] = ['Left', 'Right']

const SYMMETRICAL = 'Symmetrical'
const ASYMMETRICAL = 'Asymmetrical'

/**
 * The side of a finding and, when bilateral, its balance. The reader picks left, right or bilateral, then for a
 * bilateral finding whether it is symmetrical or dominant on one side; see {@link setLaterality}.
 */
const SIDE: ChoiceField = {
    key: 'side', kind: 'choice', label: 'Side', multiple: true, terms: [...SIDES, SYMMETRICAL, ASYMMETRICAL],
}
const AMPLITUDE: ValueField = {
    key: 'amplitude', kind: 'value', label: 'Amplitude', tag: 'Feature-amplitude', unit: 'uV',
}

/** The critical-care patterns, whose fields the schema describes by which of them each applies to. */
const PERIODIC_DISCHARGES = 'Critically-ill-patient-periodic-discharges'
const RHYTHMIC_DELTA = 'Rhythmic-delta-activity'
const SPIKE_AND_WAVE = 'Spike-or-sharp-and-wave'

/** The properties offered after a finding, per group branch, in the order they are shown and written. */
export const PROPERTY_SETS: Record<string, PropertyField[]> = {
    'Interictal-activity': [
        SIDE,
        {
            findings: ['Epileptiform-interictal-activity'],
            key: 'morphology',
            kind: 'choice',
            label: 'Morphology',
            terms: [
                'Spike', 'Spike-and-slow-wave', 'Polyspikes', 'Polyspike-and-slow-wave', 'Runs-of-rapid-spikes',
                'Fast-spike-activity', 'Sharp-wave', 'Sharp-and-slow-wave', 'Slow-sharp-wave', 'Polysharp-waves',
                'High-frequency-oscillation', 'Hypsarrhythmia-classic', 'Hypsarrhythmia-modified',
            ],
        },
        {
            // Irregular and polymorphic slowing first, the most common interictal abnormality; the irregular form is
            // not a rhythmic property in the schema, so the list is given rather than taken from that branch.
            findings: ['Abnormal-interictal-rhythmic-activity'],
            key: 'activity',
            kind: 'choice',
            label: 'Activity',
            terms: [
                'Irregular-delta-or-theta-activity', 'Polymorphic-delta-activity', 'Delta-activity', 'Theta-activity',
                'Frontal-intermittent-rhythmic-delta-activity', 'Occipital-intermittent-rhythmic-delta-activity',
                'Temporal-intermittent-rhythmic-delta-activity', 'Alpha-activity', 'Beta-activity', 'Gamma-activity',
            ],
        },
        {
            // The organisation within a discharge, which a rhythmic slowing has none of.
            findings: ['Epileptiform-interictal-activity'],
            key: 'discharge',
            kind: 'choice',
            label: 'Discharge pattern',
            under: 'Discharge-pattern',
        },
        INCIDENCE,
        {
            key: 'spread',
            kind: 'choice',
            label: 'Spread',
            multiple: true,
            terms: ['Multifocal-feature', 'Feature-propagation'],
        },
        { key: 'photic', kind: 'choice', label: 'Photic response', under: 'Intermittent-photic-stimulation-effect' },
        FREQUENCY,
    ],
    'Episode': [
        SIDE,
        { key: 'classification', kind: 'choice', label: 'Seizure type', under: 'Seizure-classification' },
        { key: 'semiology', kind: 'choice', label: 'Semiology', multiple: true, under: 'Seizure-semiology' },
        { key: 'postictal', kind: 'choice', label: 'Postictal', multiple: true, under: 'Postictal-semiology' },
        {
            key: 'context',
            kind: 'choice',
            label: 'Context',
            multiple: true,
            under: 'Episode-time-context-property',
        },
    ],
    'Background-activity': [
        SIDE,
        { key: 'rhythm', kind: 'choice', label: 'Rhythmic activity', under: 'Rhythmic-property' },
        {
            key: 'pdr',
            kind: 'choice',
            label: 'Posterior dominant rhythm',
            multiple: true,
            under: 'Posterior-dominant-rhythm-property',
        },
        PREVALENCE,
        FREQUENCY,
        AMPLITUDE,
    ],
    'Sleep-and-drowsiness': [
        SIDE,
        INCIDENCE,
    ],
    'Uncertain-significant-pattern': [
        SIDE,
        INCIDENCE,
    ],
    // The schema names the properties of a critical-care pattern after the ACNS rhythmic and periodic patterns (RPP),
    // which every field here describes, so the abbreviation is left out of the options' names.
    'Critically-ill-patient-patterns': [
        SIDE,
        {
            // The sharpness, which for these patterns is what tells a spike from a sharp wave, and triphasic beside it;
            // the schema gives both for periodic discharges and spike-and-wave only.
            findings: [PERIODIC_DISCHARGES, SPIKE_AND_WAVE],
            key: 'morphology',
            kind: 'choice',
            label: 'Morphology',
            omit: ['RPP'],
            toggle: { label: 'Triphasic', tag: 'Triphasic-morphology' },
            under: 'RPP-sharpness',
        },
        PREVALENCE,
        // The properties of the pattern as a whole, its frequency the most used of them.
        { ...FREQUENCY, heading: 'Pattern properties' },
        {
            // The length of the whole pattern run, not of one discharge, whose length decides spike or sharp wave.
            key: 'duration',
            kind: 'choice',
            label: 'Duration',
            omit: ['RPP', 'duration'],
            placeholder: 'Of the whole pattern, not one discharge',
            under: 'RPP-duration',
        },
        { key: 'onset', kind: 'choice', label: 'Onset', omit: ['RPP', 'onset'], under: 'RPP-onset' },
        { key: 'dynamics', kind: 'choice', label: 'Dynamics', omit: ['RPP', 'dynamics'], under: 'RPP-dynamics' },
        {
            findings: [PERIODIC_DISCHARGES, RHYTHMIC_DELTA],
            key: 'superimposed',
            kind: 'choice',
            label: 'Superimposed',
            multiple: true,
            omit: ['superimposed'],
            placeholder: 'No superimposed activity',
            under: 'RPP-with-superimposed-activity',
        },
    ],
    'Physiologic-pattern': [
        SIDE,
        { key: 'photic', kind: 'choice', label: 'Photic response', under: 'Intermittent-photic-stimulation-effect' },
        INCIDENCE,
    ],
    'Polygraphic-channel-feature': [
        SIDE,
        INCIDENCE,
    ],
    'Data-artifact': [
        SIDE,
        {
            key: 'significance',
            kind: 'choice',
            label: 'Significance',
            under: 'Artifact-significance-to-recording',
        },
    ],
}

/** The fewest letters of a word-form synonym that match it before it is typed whole. */
export const PARTIAL_SYNONYM_LENGTH = 3

/** The most synonyms matched by their first letters, which a short query can match many of. */
export const PARTIAL_SYNONYM_LIMIT = 5

/**
 * Abbreviations and word forms readers type, and what each stands for. Case, spaces and hyphens are ignored; see
 * {@link synonymFindings} for when each matches.
 */
export const FINDING_SYNONYMS: FindingSynonym[] = [
    { abbreviations: ['LPD', 'PLED', 'PLEDs'], finding: 'Lateralized-periodic-discharges' },
    { abbreviations: ['GPD', 'GPDs', 'GPED'], finding: 'Generalized-periodic-discharges' },
    { abbreviations: ['BIPD', 'BIPDs', 'BiPLED', 'BiPLEDs'], finding: 'Bilateral-independent-periodic-discharges' },
    { abbreviations: ['MfPD', 'MfPDs'], finding: 'Multifocal-periodic-discharges' },
    { abbreviations: ['RDA', 'LRDA', 'GRDA'], finding: 'Rhythmic-delta-activity' },
    { abbreviations: ['EDB'], finding: 'Extreme-delta-brush' },
    {
        abbreviations: ['FIRDA'],
        finding: 'Abnormal-interictal-rhythmic-activity',
        properties: ['Frontal-intermittent-rhythmic-delta-activity'],
    },
    {
        abbreviations: ['OIRDA'],
        finding: 'Abnormal-interictal-rhythmic-activity',
        properties: ['Occipital-intermittent-rhythmic-delta-activity'],
    },
    {
        abbreviations: ['TIRDA'],
        finding: 'Abnormal-interictal-rhythmic-activity',
        properties: ['Temporal-intermittent-rhythmic-delta-activity'],
    },
    // A single discharge is a finding with its waveform as a property, so the waveform's own name finds it, ahead of
    // the critical-care spike-and-wave pattern, whose name also starts with it.
    {
        abbreviations: ['spike', 'spikes'],
        finding: 'Epileptiform-interictal-activity',
        properties: ['Spike'],
    },
    {
        abbreviations: ['polyspike', 'polyspikes'],
        finding: 'Epileptiform-interictal-activity',
        properties: ['Polyspikes'],
    },
    {
        abbreviations: ['sharp wave', 'sharp waves', 'sharp-wave'],
        finding: 'Epileptiform-interictal-activity',
        properties: ['Sharp-wave'],
    },
    {
        // The schema's name for paroxysmal fast activity: a burst of spikes over 1 s at alpha frequency or above.
        abbreviations: ['PFA', 'GPFA', 'paroxysmal fast activity', 'fast spike activity'],
        finding: 'Epileptiform-interictal-activity',
        properties: ['Fast-spike-activity'],
    },
    {
        abbreviations: ['SW', 'SSW', 'spike-wave'],
        finding: 'Epileptiform-interictal-activity',
        properties: ['Spike-and-slow-wave'],
    },
    {
        abbreviations: ['PSW', 'polyspike-wave'],
        finding: 'Epileptiform-interictal-activity',
        properties: ['Polyspike-and-slow-wave'],
    },
    { abbreviations: ['IED'], finding: 'Epileptiform-interictal-activity' },
    {
        abbreviations: [
            'slow', 'slowing', 'focal slowing', 'generalized slowing', 'generalised slowing', 'IDTA',
        ],
        finding: 'Abnormal-interictal-rhythmic-activity',
        properties: ['Irregular-delta-or-theta-activity'],
    },
    {
        abbreviations: ['PDA', 'polymorphic delta'],
        finding: 'Abnormal-interictal-rhythmic-activity',
        properties: ['Polymorphic-delta-activity'],
    },
    {
        abbreviations: ['HFO'],
        finding: 'Epileptiform-interictal-activity',
        properties: ['High-frequency-oscillation'],
    },
    { abbreviations: ['PDR'], finding: 'Posterior-dominant-rhythm' },
    { abbreviations: ['ECI'], finding: 'Electrocerebral-inactivity' },
    { abbreviations: ['BS'], finding: 'Background-burst-suppression' },
    { abbreviations: ['BETS', 'SSS'], finding: 'Small-sharp-spikes' },
    { abbreviations: ['SREDA'], finding: 'Subclinical-rhythmic-EEG-discharge-adults' },
    { abbreviations: ['RMTD'], finding: 'Rhythmic-temporal-theta-burst-drowsiness' },
    { abbreviations: ['FBTCS'], finding: 'Focal-to-bilateral-tonic-clonic-focal-onset-epileptic-seizure' },
    { abbreviations: ['FAS'], finding: 'Aware-focal-onset-epileptic-seizure' },
    { abbreviations: ['FIAS'], finding: 'Impaired-awareness-focal-onset-epileptic-seizure' },
    { abbreviations: ['PLM'], finding: 'Sleep-periodic-limb-movement' },
    { abbreviations: ['RBD'], finding: 'REM-sleep-behavioral-disorder' },
    { abbreviations: ['SAT'], finding: 'Saw-tooth-waves' },
]

/** Tags of the HED standard the picker writes, which the SCORE term index does not hold, by name. */
const _standardTerms = new Map(
    STANDARD_TERMS.terms.map(term => [term.name, {
        branch: term.branch,
        term: { description: term.description, hedId: term.hedId, name: term.name, parent: null } as HedScoreTerm,
    }])
)

const _electrodes = new Map(
    [
        ...CANONICAL_ELECTRODES.electrodes.map(label => [label.toUpperCase(), label]),
        ...Object.entries(CANONICAL_ELECTRODES.renames as Record<string, string>)
                 .map(([old, label]) => [old.toUpperCase(), label]),
    ] as [string, string][]
)

/**
 * The regions the location's electrodes are listed under, in the order shown. The rows decide rather than the lobes, so
 * a long list stays easy to scan: every F electrode is frontal, every P electrode parietal, the temporal group holds
 * the FT, T and TP rows, and the central group the FC, C and CP rows. The frontopolar and occipital rows are too short
 * to stand on their own and are listed with their neighbours. The earlobe and mastoid sites are reference positions
 * over no lobe and are listed last.
 */
export const ELECTRODE_REGIONS: { electrodes: string[], label: string }[] = [
    {
        label: 'Frontal',
        electrodes: [
            'Nz', 'Fp1', 'Fpz', 'Fp2', 'AF7', 'AF3', 'AFz', 'AF4', 'AF8',
            'F9', 'F7', 'F5', 'F3', 'F1', 'Fz', 'F2', 'F4', 'F6', 'F8', 'F10',
        ],
    },
    {
        label: 'Temporal',
        electrodes: ['FT9', 'FT7', 'FT8', 'FT10', 'T9', 'T7', 'T8', 'T10', 'TP9', 'TP7', 'TP8', 'TP10'],
    },
    {
        label: 'Central',
        electrodes: [
            'FC5', 'FC3', 'FC1', 'FCz', 'FC2', 'FC4', 'FC6',
            'C5', 'C3', 'C1', 'Cz', 'C2', 'C4', 'C6',
            'CP5', 'CP3', 'CP1', 'CPz', 'CP2', 'CP4', 'CP6',
        ],
    },
    {
        label: 'Parieto-occipital',
        electrodes: [
            'P9', 'P7', 'P5', 'P3', 'P1', 'Pz', 'P2', 'P4', 'P6', 'P8', 'P10',
            'PO7', 'PO3', 'POz', 'PO4', 'PO8', 'O1', 'Oz', 'O2', 'Iz',
        ],
    },
    {
        label: 'Ear and mastoid',
        electrodes: ['A1', 'A2', 'M1', 'M2'],
    },
]

/**
 * `labels` listed under their regions, in each region's order, leaving out regions none of them is in. A label in no
 * region is listed last, under `Other`.
 * @param labels - Canonical electrode labels.
 */
export function electrodesByRegion (labels: string[]) {
    const wanted = new Set(labels)
    const regions = ELECTRODE_REGIONS
        .map(region => ({ electrodes: region.electrodes.filter(label => wanted.has(label)), label: region.label }))
    const placed = new Set(ELECTRODE_REGIONS.flatMap(region => region.electrodes))
    regions.push({ electrodes: labels.filter(label => !placed.has(label)), label: 'Other' })
    return regions.filter(region => region.electrodes.length)
}

/**
 * The canonical label of an electrode, or `null` when `label` names none: `fp1` reads as `Fp1` and `T3` as `T7`. Only
 * a closed set is returned, since a raw acquisition label in a tag string would carry the site's naming convention.
 * A derivation reads as its first electrode, the one an annotation is drawn on.
 * @param label - Channel name or label.
 */
export function canonicalElectrode (label: string) {
    return _electrodes.get(label.trim().split('-')[0].toUpperCase()) ?? null
}

/**
 * How `code`'s bilateral finding is balanced; empty for one that is not bilateral or not said to be either.
 * @param code - The finding and its properties.
 */
export function balanceOf (code: FindingCode): Balance {
    if (lateralityOf(code) !== 'bilateral') {
        return ''
    }
    if (code.properties.includes(SYMMETRICAL)) {
        return 'symmetrical'
    }
    if (code.properties.includes(ASYMMETRICAL)) {
        return code.dominantSide ?? 'asymmetrical'
    }
    return ''
}

/**
 * Whether a synonym is an acronym, written with two or more capitals, such as `SW` or `BiPLEDs`.
 * @param synonym - The synonym as written in the table.
 */
export function isAcronym (synonym: string) {
    return (synonym.match(/[A-Z]/g)?.length ?? 0) >= 2
}

/**
 * Where `code`'s finding is: left, right, bilateral when both sides are among its properties, or empty.
 * @param code - The finding and its properties.
 */
export function lateralityOf (code: FindingCode): Laterality {
    const sides = SIDES.filter(side => code.properties.includes(side))
    return sides.length === 2 ? 'bilateral' : sides[0] ?? ''
}

/**
 * The side a set of electrodes lies on, by the 10-10 names: an odd number is left, an even one right, and a `z` the
 * midline. Left or right when every lateral electrode is on that side, bilateral when both sides have one, and empty
 * when none is lateral, as for a midline or global finding.
 * @param labels - Canonical electrode labels.
 */
export function sensorLaterality (labels: string[]): Laterality {
    const sides = new Set<Side>()
    for (const label of labels) {
        const number = label.match(/(\d+)$/)
        if (number) {
            sides.add(Number(number[1])%2 ? 'Left' : 'Right')
        }
    }
    return sides.size === 2 ? 'bilateral' : [...sides][0] ?? ''
}

/**
 * Set how `code`'s bilateral finding is balanced. Symmetrical is written as `Symmetrical`; a dominant side as
 * `Asymmetrical` and the side's dominance, so a reader who does not follow the relation still reads the asymmetry.
 * Does nothing to a finding that is not bilateral.
 * @param code - The finding and its properties, changed in place.
 * @param balance - The balance, or empty for none.
 */
export function setBalance (code: FindingCode, balance: Balance) {
    if (lateralityOf(code) !== 'bilateral') {
        return
    }
    code.properties = code.properties.filter(name => name !== SYMMETRICAL && name !== ASYMMETRICAL)
    delete code.dominantSide
    if (balance === 'symmetrical') {
        code.properties.push(SYMMETRICAL)
    } else if (balance) {
        code.properties.push(ASYMMETRICAL)
        if (balance !== 'asymmetrical') {
            code.dominantSide = balance
        }
    }
}

/**
 * Set where `code`'s finding is. Bilateral is written as both sides; leaving bilateral drops its balance, and staying
 * bilateral keeps it.
 * @param code - The finding and its properties, changed in place.
 * @param laterality - Where the finding is, or empty for not given.
 */
export function setLaterality (code: FindingCode, laterality: Laterality) {
    if (laterality === 'bilateral' && lateralityOf(code) === 'bilateral') {
        return
    }
    const sideTags = [...SIDES, SYMMETRICAL, ASYMMETRICAL] as string[]
    code.properties = code.properties.filter(name => !sideTags.includes(name))
    delete code.dominantSide
    if (laterality === 'bilateral') {
        code.properties.push(...SIDES)
    } else if (laterality) {
        code.properties.push(laterality)
    }
}

/**
 * Move `code`'s finding to the electrodes `sensors`. A side that is still what the old location gave follows the new
 * one; a side the reader chose stays. Electrodes of the maximum outside the new location are dropped, and the maximum
 * with them when none is left.
 * @param code - The finding and its properties, changed in place.
 * @param sensors - Canonical electrode labels of the new location; none for a finding with no location.
 * @param hasSide - Whether the finding's set offers a side, so the side may follow.
 */
export function relocate (code: FindingCode, sensors: string[], hasSide: boolean) {
    const followsLocation = lateralityOf(code) === sensorLaterality(code.sensors)
    code.sensors = [...sensors]
    if (followsLocation && hasSide) {
        setLaterality(code, sensorLaterality(code.sensors))
    }
    const max = code.maxSensors?.filter(label => code.sensors.includes(label))
    if (max?.length) {
        code.maxSensors = max
    } else {
        delete code.maxSensors
    }
}

/**
 * `value` with its finding moved to the electrodes `sensors`, as {@link relocate} moves it, so a finding repeated on
 * other channels says where each copy is. A string the picker did not write, or one whose location the policy does not
 * allow, is returned as it is.
 * @param value - HED string.
 * @param sensors - Canonical electrode labels of the new location.
 * @param index - The loaded term index.
 * @param policy - The host's policy, or `null` with no host.
 */
export function relocatedFindingCode (
    value: string,
    sensors: string[],
    index: HedScoreTermIndex,
    policy: HedScorePolicy | null,
) {
    const code = parseFindingCode(value, index)
    if (!code || !sensorsAllowed(index, policy)) {
        return value
    }
    const fields = offeredFields(index, policy, code.finding)
    relocate(code, sensors, fields.some(field => field.key === 'side'))
    return composeFindingCode(code, fields)
}

/**
 * The finding and properties `value` was written as, or `null` for a string the picker did not write: groups nested
 * other than as a comparison, a tag the index does not hold, a value it cannot read back, or a finding that is not a
 * term on its own.
 * @param value - HED string.
 * @param index - The loaded term index.
 */
export function parseFindingCode (value: string, index: HedScoreTermIndex): FindingCode | null {
    let parts = splitTopLevel(value)
    if (parts?.length === 1 && parts[0].startsWith('(')) {
        parts = splitTopLevel(parts[0].slice(1, -1))
    }
    if (!parts) {
        return null
    }
    const [finding, ...rest] = parts
    if (!finding || /[/(]/.test(finding) || !index.getTerm(finding)) {
        return null
    }
    const code: FindingCode = { finding, properties: [], sensors: [], values: {} }
    // Each value tag's numbers, by the comparison they were written with (`null` for none).
    const numbers = new Map<string, { relation: string | null, value: number }[]>()
    // The rest of the location a maximum was written against, checked once the location is known.
    let lesserSensors = null as string[] | null
    for (const part of rest) {
        let relation = null as string | null
        let tag = part
        if (part.startsWith('(')) {
            const dominance = readDominance(part)
            if (dominance === null) {
                return null
            }
            if (dominance) {
                if ('side' in dominance && !code.dominantSide) {
                    code.dominantSide = dominance.side
                } else if ('greater' in dominance && !code.maxSensors) {
                    code.maxSensors = dominance.greater
                    lesserSensors = dominance.lesser
                } else {
                    return null
                }
                continue
            }
            const inner = splitTopLevel(part.slice(1, -1))
            if (inner?.length !== 2 || ![MIN_RELATION, MAX_RELATION, ABOUT_RELATION].includes(inner[0])) {
                return null
            }
            [relation, tag] = inner
        }
        const [name, ...valueParts] = tag.split('/')
        const term = termOf(index, name)
        if (!term || /[()]/.test(tag)) {
            return null
        }
        if (!valueParts.length) {
            if (relation) {
                return null
            }
            code.properties.push(name)
            continue
        }
        const tagValue = valueParts.join('/')
        if (name === SENSOR_LIST && !relation) {
            const sensors = tagValue.split(SENSOR_SEPARATOR)
            // One location, of named electrodes: a second would be dropped by the next write.
            if (code.sensors.length || sensors.some(label => !label)) {
                return null
            }
            code.sensors = sensors
            continue
        }
        const match = tagValue.match(/^([+-]?\d+(?:\.\d+)?)(?: (\S+))?$/)
        const unit = term.unitClasses?.length ? index.units[term.unitClasses[0]]?.default : null
        if (!match || (match[2] && match[2] !== unit)) {
            return null
        }
        numbers.set(name, [...numbers.get(name) ?? [], { relation, value: Number(match[1]) }])
    }
    for (const [name, written] of numbers) {
        const found = readValue(written)
        if (!found) {
            return null
        }
        code.values[name] = found
    }
    // A tag written twice would be written once by the next write.
    if (new Set(code.properties).size !== code.properties.length) {
        return null
    }
    // Symmetry is said only of a bilateral finding, one way, and a dominant side only of an asymmetrical one.
    const bilateral = SIDES.every(side => code.properties.includes(side))
    const symmetrical = code.properties.includes(SYMMETRICAL)
    const asymmetrical = code.properties.includes(ASYMMETRICAL)
    if (((symmetrical || asymmetrical) && !bilateral) || (symmetrical && asymmetrical)
        || (code.dominantSide && !asymmetrical)) {
        return null
    }
    if (code.maxSensors) {
        const location = new Set(code.sensors)
        const compared = [...code.maxSensors, ...lesserSensors ?? []]
        if (!lesserSensors?.length || new Set(compared).size !== compared.length || compared.length !== location.size
            || !compared.every(label => location.has(label))) {
            return null
        }
    }
    return code
}

/**
 * The HED string `code` is stored as: the finding's tag alone, or one group with the finding first, then its
 * properties and values in the order of their fields, then its location. A property no field offers keeps its place
 * after the offered ones, so a string read back unchanged is written back unchanged.
 * @param code - The finding and its properties.
 * @param fields - The fields offered for the finding's group.
 */
export function composeFindingCode (code: FindingCode, fields: OfferedField[] = []) {
    const order = new Map<string, number>()
    for (const field of fields) {
        const names = field.kind === 'choice'
            ? [...field.options, ...field.toggleOption ? [field.toggleOption] : []].map(option => option.term.name)
            : [field.tag]
        for (const name of names) {
            order.set(name, order.size)
        }
    }
    const rank = (name: string) => order.get(name) ?? order.size
    const values = Object.entries(code.values).map(([tag, number]) => {
        const field = fields.find(field => field.kind === 'value' && field.tag === tag) as ValueField | undefined
        return { name: tag, tags: valueTags(tag, number, field?.unit) }
    })
    const tags = [...code.properties.map(name => ({ name, tags: [name] })), ...values]
        // Sorting is stable, so tags no field offers keep their order among themselves.
        .sort((a, b) => rank(a.name) - rank(b.name))
        .flatMap(entry => entry.tags)
    const dominant = code.dominantSide
    if (dominant && SIDES.every(side => code.properties.includes(side)) && code.properties.includes(ASYMMETRICAL)) {
        tags.push(`(${dominant}, (${GREATER_RELATION}, ${SIDES.find(side => side !== dominant)}))`)
    }
    if (code.sensors.length) {
        tags.push(`${SENSOR_LIST}/${code.sensors.join(SENSOR_SEPARATOR)}`)
        const greater = code.sensors.filter(label => code.maxSensors?.includes(label))
        const lesser = code.sensors.filter(label => !greater.includes(label))
        if (greater.length && lesser.length) {
            tags.push(
                `(${SENSOR_LIST}/${greater.join(SENSOR_SEPARATOR)}, `
                + `(${GREATER_RELATION}, ${SENSOR_LIST}/${lesser.join(SENSOR_SEPARATOR)}))`
            )
        }
    }
    return tags.length ? `(${[code.finding, ...tags].join(', ')})` : code.finding
}

/**
 * Whether the comparison tags are allowed under `policy`, so a value may be given as more than an exact number.
 * @param policy - The host's policy, or `null` with no host.
 */
export function relationsAllowed (policy: HedScorePolicy | null) {
    return !policy?.allowedBranches || policy.allowedBranches.includes(RELATION_BRANCH)
}

/**
 * A value as the reader reads it: `≈ 3 Hz`, `2–3 Hz`.
 * @param value - The value.
 * @param unit - The unit it is written in, if any.
 */
export function valueText (value: FindingValue, unit = '') {
    const suffix = unit ? ` ${unit}` : ''
    if (value.mode === 'range') {
        return `${value.value}–${value.upper ?? value.value}${suffix}`
    }
    const symbol = VALUE_MODES.find(mode => mode.mode === value.mode)?.symbol
    return `${value.mode === 'exact' ? '' : `${symbol} `}${value.value}${suffix}`
}

/**
 * The fields offered after `finding` under `policy`: its group's set, less the fields that apply only to other findings
 * of the group, each choice resolved to the terms that stand as a code and that the policy allows. A field left with no
 * choices is dropped, and so is a value field whose tag the policy or the index does not allow.
 * @param index - The loaded term index.
 * @param policy - The host's policy, or `null` with no host.
 * @param finding - The finding's short-form tag.
 */
export function offeredFields (index: HedScoreTermIndex, policy: HedScorePolicy | null, finding: string) {
    const lineage = lineageOf(index, finding)
    const suits = (names: string[]) => names.some(name => lineage.has(name) || lineageOf(index, name).has(finding))
    const allowed = (term: HedScoreTerm | null): term is HedScoreTerm => !!term && !term.deprecated
        && (!policy?.allowedBranches || policy.allowedBranches.includes(schemaBranchOf(index, term.name) ?? ''))
    const offered = [] as OfferedField[]
    for (const field of PROPERTY_SETS[index.branchOf(finding) ?? ''] ?? []) {
        if (field.findings && !suits(field.findings)) {
            continue
        }
        if (field.kind === 'value') {
            if (allowed(index.getTerm(field.tag))) {
                offered.push(field)
            }
            continue
        }
        const terms = field.terms
            ? field.terms.map(name => termOf(index, name))
            : descendants(index, field.under ?? '')
        const options = terms.filter(allowed).filter(term => !term.requireChild)
                             .map(term => ({ label: optionLabel(term.name, field.omit), term }))
        const toggle = field.toggle ? termOf(index, field.toggle.tag) : null
        const toggleOption = field.toggle && allowed(toggle) && !toggle.requireChild
            ? { label: field.toggle.label, term: toggle }
            : undefined
        if (options.length) {
            offered.push({ ...field, options, toggleOption })
        }
    }
    return offered
}

/**
 * Whether the location tag is allowed under `policy`, so a picked finding may be given one.
 * @param index - The loaded term index.
 * @param policy - The host's policy, or `null` with no host.
 */
export function sensorsAllowed (index: HedScoreTermIndex, policy: HedScorePolicy | null) {
    return !policy?.allowedBranches
        || policy.allowedBranches.includes(index.schemaBranchOf(SENSOR_LIST) ?? '')
}

/**
 * The offered findings an abbreviation in `query` stands for, with the properties each sets. A synonym whose finding
 * is not offered, or one of whose properties is not allowed, is left out.
 *
 * An acronym, written with two or more capitals, matches only when typed whole, since its first letters would match
 * half the table. A word form such as "polyspike" also matches from its first {@link PARTIAL_SYNONYM_LENGTH} letters,
 * so a finding filed under another name is offered before the word is finished. Whole matches come first, then the
 * partial ones, at most {@link PARTIAL_SYNONYM_LIMIT} of them.
 * @param offered - The offered terms.
 * @param query - What the reader typed.
 * @param index - The loaded term index.
 * @param policy - The host's policy, or `null` with no host.
 */
export function synonymFindings (
    offered: OfferedFinding[],
    query: string,
    index: HedScoreTermIndex,
    policy: HedScorePolicy | null,
) {
    const typed = normalizedSynonym(query)
    if (!typed) {
        return []
    }
    const byName = new Map(offered.map(finding => [finding.term.name, finding]))
    const whole = [] as OfferedFinding[]
    const partial = [] as OfferedFinding[]
    for (const synonym of FINDING_SYNONYMS) {
        const finding = byName.get(synonym.finding)
        if (!finding) {
            continue
        }
        let abbreviation = synonym.abbreviations.find(abbr => normalizedSynonym(abbr) === typed)
        const matches = abbreviation ? whole : partial
        if (!abbreviation && typed.length >= PARTIAL_SYNONYM_LENGTH) {
            abbreviation = synonym.abbreviations.find(
                abbr => !isAcronym(abbr) && normalizedSynonym(abbr).startsWith(typed)
            )
        }
        if (!abbreviation) {
            continue
        }
        const properties = synonym.properties ?? []
        const fields = offeredFields(index, policy, finding.term.name)
        const offeredProperties = new Set(
            fields.flatMap(field => field.kind === 'choice' ? field.options.map(option => option.term.name) : [])
        )
        if (!properties.every(name => offeredProperties.has(name))) {
            continue
        }
        const label = [finding.label, ...properties.map(findingLabel)].join(': ')
        matches.push({ ...finding, abbreviation, label, properties })
    }
    return [...whole, ...partial.slice(0, PARTIAL_SYNONYM_LIMIT)]
}

/**
 * Every term under `root` in index order, `root` itself excluded.
 * @param index - The loaded term index.
 * @param root - Short-form tag.
 */
function descendants (index: HedScoreTermIndex, root: string) {
    const within = new Set([root])
    const found = [] as HedScoreTerm[]
    // Terms are listed parents first, so a parent is known to be within before its children are reached.
    for (const term of index.terms) {
        if (term.parent && within.has(term.parent)) {
            within.add(term.name)
            found.push(term)
        }
    }
    return found
}

/**
 * `name` and every term above it.
 * @param index - The loaded term index.
 * @param name - Short-form tag.
 */
function lineageOf (index: HedScoreTermIndex, name: string) {
    const lineage = new Set<string>()
    for (let term: string | null = name; term && !lineage.has(term); term = index.getTerm(term)?.parent ?? null) {
        lineage.add(term)
    }
    return lineage
}

/**
 * A synonym or query as matched: lower case, without spaces or hyphens, so "poly spike" finds "polyspike".
 * @param text - The synonym or what the reader typed.
 */
function normalizedSynonym (text: string) {
    return text.toLowerCase().replace(/[\s-]+/g, '')
}

/**
 * The name an option is shown by: the tag's readable name without the words its field leaves out, case ignored, and
 * with its first letter capitalised. A name left with no words keeps them all.
 * @param name - Short-form tag.
 * @param omit - Words to leave out.
 */
function optionLabel (name: string, omit: string[] = []) {
    const left = omit.map(word => word.toLowerCase())
    const words = findingLabel(name).split(' ').filter(word => !left.includes(word.toLowerCase()))
    if (!words.length) {
        return findingLabel(name)
    }
    const label = words.join(' ')
    return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * A dominance group read back: `false` when `part` is no dominance, so it may be read as something else, `null` when it
 * is one but not in a form the picker writes.
 * @param part - A group of the finding's string, parentheses included.
 */
function readDominance (part: string): { side: Side } | { greater: string[], lesser: string[] } | false | null {
    const inner = splitTopLevel(part.slice(1, -1))
    if (inner?.length !== 2 || !inner[1].startsWith('(')) {
        return false
    }
    const relation = splitTopLevel(inner[1].slice(1, -1))
    if (relation?.length !== 2 || relation[0] !== GREATER_RELATION) {
        return null
    }
    const [greater, lesser] = [inner[0], relation[1]]
    if (SIDES.includes(greater as Side) && SIDES.includes(lesser as Side) && greater !== lesser) {
        return { side: greater as Side }
    }
    const prefix = `${SENSOR_LIST}/`
    if (greater.startsWith(prefix) && lesser.startsWith(prefix)) {
        return {
            greater: greater.slice(prefix.length).split(SENSOR_SEPARATOR),
            lesser: lesser.slice(prefix.length).split(SENSOR_SEPARATOR),
        }
    }
    return null
}

/**
 * A value tag's numbers read back as one value, or `null` when they are not one of the forms the picker writes: one
 * number, one bound, one approximation, or the two inclusive bounds of a range in order.
 * @param written - The numbers, with the comparison each was written with.
 */
function readValue (written: { relation: string | null, value: number }[]): FindingValue | null {
    if (written.length === 1) {
        const [{ relation, value }] = written
        const mode = VALUE_MODES.find(entry => entry.relation === relation && entry.mode !== 'range')
        return mode ? { mode: mode.mode, value } : null
    }
    const lower = written.find(entry => entry.relation === MIN_RELATION)
    const upper = written.find(entry => entry.relation === MAX_RELATION)
    if (written.length === 2 && lower && upper && lower.value <= upper.value) {
        return { mode: 'range', upper: upper.value, value: lower.value }
    }
    return null
}

/**
 * The top-level branch of the merged schema `name` sits under, which a branch policy names, or `null`.
 * @param index - The loaded term index.
 * @param name - Short-form tag.
 */
function schemaBranchOf (index: HedScoreTermIndex, name: string) {
    return index.schemaBranchOf(name) ?? _standardTerms.get(name)?.branch ?? null
}

/**
 * The parts of `text` separated by the commas outside parentheses, trimmed, or `null` when its parentheses do not
 * balance or a part is empty.
 * @param text - HED string or the inside of a group.
 */
function splitTopLevel (text: string) {
    const parts = [] as string[]
    let depth = 0
    let start = 0
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '(') {
            depth++
        } else if (text[i] === ')') {
            depth--
            if (depth < 0) {
                return null
            }
        } else if (text[i] === ',' && depth === 0) {
            parts.push(text.slice(start, i).trim())
            start = i + 1
        }
    }
    parts.push(text.slice(start).trim())
    return depth || parts.some(part => !part) ? null : parts
}

/**
 * The term named `name`, from the index or from the standard tags the picker writes, or `null`.
 * @param index - The loaded term index.
 * @param name - Short-form tag.
 */
function termOf (index: HedScoreTermIndex, name: string) {
    return index.getTerm(name) ?? _standardTerms.get(name)?.term ?? null
}

/**
 * The tags a value is written as.
 * @param tag - The value field's tag.
 * @param value - The value.
 * @param unit - The unit, if the field names one.
 */
function valueTags (tag: string, value: FindingValue, unit?: string) {
    const write = (number: number) => unit ? `${tag}/${number} ${unit}` : `${tag}/${number}`
    const bound = (relation: string, number: number) => `(${relation}, ${write(number)})`
    switch (value.mode) {
        case 'about':
            return [bound(ABOUT_RELATION, value.value)]
        case 'max':
            return [bound(MAX_RELATION, value.value)]
        case 'min':
            return [bound(MIN_RELATION, value.value)]
        case 'range':
            return value.upper === undefined
                ? [bound(MIN_RELATION, value.value)]
                : [bound(MIN_RELATION, value.value), bound(MAX_RELATION, value.upper)]
        default:
            return [write(value.value)]
    }
}
