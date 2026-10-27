<template>
    <!-- Read-only, an event without a finding is a plain event and has nothing to show here. -->
    <div v-if="state !== 'hidden' && (code || !disabled)" data-component="finding-picker">
        <div v-if="state === 'loading'" class="status">
            <wa-spinner></wa-spinner>
        </div>
        <div v-else-if="state === 'unavailable'" class="status">{{ statusMessage }}</div>
        <template v-else>
            <div class="row">
                <app-icon class="icon" name="wave-pulse"></app-icon>
                <div v-if="code"
                    class="selected"
                    :class="{ 'selected--readonly': disabled }"
                    :title="selectedDescription"
                >
                    <span class="label">{{ selectedLabel }}</span>
                    <span v-if="selectedGroup" class="group">{{ $t(selectedGroup) }}</span>
                    <template v-if="findingGroup !== null">
                        <span class="finding-group">{{ $t('Group {number}', { number: findingGroup }) }}</span>
                        <wa-button v-if="!disabled"
                            appearance="plain"
                            id="finding-picker-ungroup-button"
                            size="s"
                            @click="leaveGroup"
                        >
                            <app-icon name="link-slash"></app-icon>
                        </wa-button>
                        <wa-tooltip v-if="!disabled" for="finding-picker-ungroup-button">
                            {{ $t('Take this event out of group {number}', { number: findingGroup }) }}
                        </wa-tooltip>
                    </template>
                    <wa-button v-if="!disabled" ref="clearbtn"
                        appearance="plain"
                        id="finding-picker-clear-button"
                        size="s"
                        @click="clear"
                    >
                        <app-icon name="xmark"></app-icon>
                    </wa-button>
                    <wa-tooltip v-if="!disabled" for="finding-picker-clear-button">
                        {{ $t('Remove finding') }}
                    </wa-tooltip>
                </div>
                <wa-input v-else ref="search"
                    :disabled="disabled"
                    :placeholder="$t('Finding')"
                    size="s"
                    :value="query"
                    @input="updateQuery($event.target.value)"
                    @keydown="handleSearchKeydown"
                ></wa-input>
                <wa-select v-if="!code && !disabled"
                    :placeholder="$t('Browse')"
                    size="s"
                    :value="group"
                    with-clear
                    @input="selectGroup($event.target.value)"
                >
                    <wa-option v-for="findingGroup of groups" :key="`finding-group-${findingGroup.branch}`"
                        :value="findingGroup.branch"
                    >{{ $t(findingGroup.label) }}</wa-option>
                    <template v-if="recordedEntries.length">
                        <wa-divider class="browse-divider"></wa-divider>
                        <wa-option :value="RECORDED_GROUPS">{{ $t('Finding groups') }}</wa-option>
                    </template>
                </wa-select>
                <template v-if="applyToGroup && findingGroup !== null && groupMembers && !disabled">
                    <wa-button
                        appearance="plain"
                        class="apply"
                        id="finding-picker-apply-button"
                        size="s"
                        @click="applyToGroup"
                    >
                        <app-icon name="check-double"></app-icon>
                    </wa-button>
                    <wa-tooltip for="finding-picker-apply-button">
                        {{ $t(
                            'Save and apply to the other {count} events of group {number}, each keeping its location',
                            { count: groupMembers, number: findingGroup }
                        ) }}
                    </wa-tooltip>
                </template>
                <template v-if="stamp && !disabled">
                    <wa-button
                        appearance="plain"
                        class="stamp"
                        id="finding-picker-stamp-button"
                        size="s"
                        @click="stamp"
                    >
                        <app-icon name="stamp"></app-icon>
                    </wa-button>
                    <wa-tooltip for="finding-picker-stamp-button">
                        {{ $t('Save and stamp: each click on the signal adds a copy of this event') }}
                    </wa-tooltip>
                </template>
            </div>
            <div v-if="parsed && (disabled ? chips.length : fields.length || canLocate)" class="properties">
                <div class="chips">
                    <span v-for="chip of chips" :key="`finding-chip-${chip.key}`" class="chip">
                        {{ chip.label }}
                        <button v-if="!disabled"
                            :aria-label="removeLabel(chip)"
                            class="chip-remove"
                            :id="`finding-chip-remove-${chip.key}`"
                            type="button"
                            @click="removeChip(chip)"
                            @mousedown.prevent
                        >
                            <app-icon name="xmark"></app-icon>
                        </button>
                        <wa-tooltip v-if="!disabled" :for="`finding-chip-remove-${chip.key}`">
                            {{ removeLabel(chip) }}
                        </wa-tooltip>
                    </span>
                    <button v-if="!disabled" ref="toggle"
                        :aria-expanded="expanded"
                        class="toggle"
                        type="button"
                        @click="toggleProperties"
                    >
                        <app-icon :name="expanded ? 'chevron-up' : 'chevron-down'"></app-icon>
                        {{ $t('Properties') }}
                    </button>
                </div>
                <div v-if="expanded && !disabled" class="fields">
                    <template v-for="{ field, heading, key } of rows" :key="`finding-row-${key}`">
                        <div v-if="heading" class="heading">{{ $t(heading) }}</div>
                        <template v-if="!field">
                            <label for="finding-field-location">{{ $t('Location') }}</label>
                            <wa-select
                                :disabled="disabled"
                                id="finding-field-location"
                                :max-options-visible="4"
                                multiple
                                size="s"
                                :value="parsed.sensors"
                                with-clear
                                @input="setSensors($event.target.value)"
                            >
                                <template v-for="region of electrodeRegions" :key="`finding-region-${region.label}`">
                                    <small class="region">{{ $t(region.label) }}</small>
                                    <wa-option v-for="label of region.electrodes" :key="`finding-electrode-${label}`"
                                        :value="label"
                                    >{{ label }}</wa-option>
                                </template>
                            </wa-select>
                            <template v-if="canCompareSensors">
                                <label for="finding-field-maximum">{{ $t('Maximum') }}</label>
                                <wa-select
                                    :disabled="disabled"
                                    id="finding-field-maximum"
                                    :max-options-visible="4"
                                    multiple
                                    size="s"
                                    :value="parsed.maxSensors ?? []"
                                    with-clear
                                    @input="setMaxSensors($event.target.value)"
                                >
                                    <wa-option v-for="label of parsed.sensors" :key="`finding-maximum-${label}`"
                                        :value="label"
                                    >{{ label }}</wa-option>
                                </wa-select>
                            </template>
                        </template>
                        <template v-else>
                            <label :for="`finding-field-${field.key}`">{{ $t(field.label) }}</label>
                            <div v-if="field.key === 'side'" class="side-field">
                                <wa-select
                                    :disabled="disabled"
                                    :id="`finding-field-${field.key}`"
                                    size="s"
                                    :value="laterality"
                                    with-clear
                                    @input="setSide($event.target.value)"
                                >
                                    <wa-option v-for="option of lateralityOptions" :key="`finding-side-${option.value}`"
                                        :value="option.value"
                                    >{{ $t(option.label) }}</wa-option>
                                </wa-select>
                                <wa-select v-if="laterality === 'bilateral'"
                                    :aria-label="$t('Balance')"
                                    :disabled="disabled"
                                    :placeholder="$t('Balance')"
                                    size="s"
                                    :value="balance"
                                    with-clear
                                    @input="setSideBalance($event.target.value)"
                                >
                                    <wa-option v-for="option of balanceOptions" :key="`finding-balance-${option.value}`"
                                        :value="option.value"
                                    >{{ $t(option.label) }}</wa-option>
                                </wa-select>
                            </div>
                            <div v-else-if="field.kind === 'choice' && field.toggleOption" class="toggle-field">
                                <wa-select
                                    :disabled="disabled"
                                    :id="`finding-field-${field.key}`"
                                    :max-options-visible="field.multiple ? 2 : undefined"
                                    :multiple="field.multiple"
                                    :placeholder="field.placeholder ? $t(field.placeholder) : undefined"
                                    size="s"
                                    :value="choiceValue(field)"
                                    with-clear
                                    @input="setChoice(field, $event.target.value)"
                                >
                                    <wa-option v-for="opt of field.options" :key="`finding-option-${opt.term.name}`"
                                        :title="opt.term.description"
                                        :value="opt.term.name"
                                    >{{ opt.label }}</wa-option>
                                </wa-select>
                                <wa-checkbox
                                    :checked="parsed.properties.includes(field.toggleOption.term.name)"
                                    :disabled="disabled"
                                    size="s"
                                    :title="field.toggleOption.term.description"
                                    @change="setToggle(field, $event.target.checked)"
                                >{{ $t(field.toggleOption.label) }}</wa-checkbox>
                            </div>
                            <wa-select v-else-if="field.kind === 'choice'"
                                :disabled="disabled"
                                :id="`finding-field-${field.key}`"
                                :max-options-visible="field.multiple ? 2 : undefined"
                                :multiple="field.multiple"
                                :placeholder="field.placeholder ? $t(field.placeholder) : undefined"
                                size="s"
                                :value="choiceValue(field)"
                                with-clear
                                @input="setChoice(field, $event.target.value)"
                            >
                                <wa-option v-for="option of field.options" :key="`finding-option-${option.term.name}`"
                                    :title="option.term.description"
                                    :value="option.term.name"
                                >{{ option.label }}</wa-option>
                            </wa-select>
                            <div v-else class="value-field">
                                <wa-select v-if="valueModes.length > 1"
                                    :aria-label="$t('Comparison')"
                                    class="mode"
                                    :disabled="disabled"
                                    size="s"
                                    :value="modeOf(field)"
                                    @input="setValueMode(field, $event.target.value)"
                                >
                                    <wa-option v-for="mode of valueModes" :key="`finding-mode-${mode.mode}`"
                                        :title="$t(mode.title)"
                                        :value="mode.mode"
                                    >{{ mode.symbol }}</wa-option>
                                </wa-select>
                                <wa-input
                                    :disabled="disabled"
                                    :id="`finding-field-${field.key}`"
                                    :max="domainOf(field).high"
                                    :min="domainOf(field).low"
                                    size="s"
                                    :step="domainOf(field).step"
                                    type="number"
                                    :value="parsed.values[field.tag]?.value ?? ''"
                                    @change="setValue(field, 'value', $event.target.value)"
                                >
                                    <span v-if="modeOf(field) !== 'range'" slot="end">{{ field.unit }}</span>
                                </wa-input>
                                <template v-if="modeOf(field) === 'range'">
                                    <span class="dash">–</span>
                                    <wa-input
                                        :aria-label="$t('Upper bound')"
                                        :disabled="disabled || parsed.values[field.tag] === undefined"
                                        :max="domainOf(field).high"
                                        :min="domainOf(field).low"
                                        size="s"
                                        :step="domainOf(field).step"
                                        type="number"
                                        :value="parsed.values[field.tag]?.upper ?? ''"
                                        @change="setValue(field, 'upper', $event.target.value)"
                                    >
                                        <span slot="end">{{ field.unit }}</span>
                                    </wa-input>
                                </template>
                            </div>
                        </template>
                    </template>
                </div>
            </div>
            <!-- One tab stop for the whole list: the arrow keys move within it, as from the search field. -->
            <div v-if="results.length" ref="list"
                :aria-activedescendant="`finding-result-${highlighted}`"
                class="results"
                role="listbox"
                tabindex="0"
                @keydown="handleListKeydown"
            >
                <button v-for="(finding, idx) of results" :key="`finding-result-${resultKey(finding)}`"
                    :aria-selected="idx === highlighted"
                    :class="['result', { 'result--active': idx === highlighted }]"
                    :id="`finding-result-${idx}`"
                    role="option"
                    tabindex="-1"
                    :title="resultTitle(finding)"
                    type="button"
                    @click="pick(finding)"
                    @mousedown.prevent
                    @mousemove="highlightResult(idx)"
                >
                    <span class="result-label">
                        <span v-if="showsAbbreviation(finding)" class="abbreviation">
                            {{ finding.abbreviation }}
                        </span>
                        {{ finding.label }}
                    </span>
                    <span class="group">{{ groupTag(finding) }}</span>
                </button>
            </div>
            <div v-else-if="listedGroups.length" ref="list"
                :aria-activedescendant="`finding-recorded-group-${highlighted}`"
                class="results"
                role="listbox"
                tabindex="0"
                @keydown="handleListKeydown"
            >
                <button v-for="(entry, idx) of listedGroups" :key="`finding-recorded-group-${entry.group.number}`"
                    :aria-selected="idx === highlighted"
                    :class="['result', { 'result--active': idx === highlighted }]"
                    :id="`finding-recorded-group-${idx}`"
                    role="option"
                    tabindex="-1"
                    :title="entry.group.code"
                    type="button"
                    @click="pickGroup(entry)"
                    @mousedown.prevent
                    @mousemove="highlightResult(idx)"
                >
                    <span class="result-label">
                        <span class="number">{{ entry.group.number }}</span>
                        {{ entry.label }}
                    </span>
                    <span class="group">{{ entry.description }}</span>
                </button>
            </div>
            <div v-if="palette.length && !code && !disabled" class="palette">
                <button v-for="(finding, idx) of palette" :key="`finding-palette-${finding.term.name}`"
                    class="palette-item"
                    :title="paletteTitle(finding)"
                    type="button"
                    @click="pick(finding)"
                    @mousedown.prevent
                >
                    <span v-if="idx < 10" class="key">{{ (idx + 1)%10 }}</span>
                    {{ finding.label }}
                </button>
            </div>
            <div class="attribution" :title="attribution">{{ attributionShort }}</div>
        </template>
    </div>
</template>

<script lang="ts">
/**
 * Codes an annotation's finding in HED-SCORE: a search field over the offered terms and the abbreviations readers type,
 * a browsable list per group, and the host's quick palette, then the finding's optional properties. Emits the HED
 * string to store under `codes.hed`, or `null` to remove it. The Browse menu also lists the recording's finding
 * groups, and joining one copies its finding to the event as a copy of an annotation is made.
 *
 * A pick fills in what the view already knows: the location from the electrodes the annotation is drawn on, the side
 * those electrodes lie on, and a frequency measured within its span. All are the reader's to change. A stored string
 * the picker did not write is shown as it is and its properties are not offered, so an edit cannot rewrite it.
 *
 * The terms come from eeg-module's index, loaded when the picker first opens. The host's policy, when one is
 * configured, narrows what is offered to what its server accepts, hides the picker when the server takes no HED
 * codes, and disables it when the server validates against another schema release.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */
import { defineComponent, PropType, Ref, ref, shallowRef } from "vue"
import { T } from "#i18n"
import { loadHedScoreIndex } from "@epicurrents/eeg-module"
import type { HedScoreTermIndex } from "@epicurrents/eeg-module/types"
import type { HedScorePolicy } from "#app/modules/eeg/types"
import type { default as WaButton } from "@awesome.me/webawesome/dist/components/button/button.js"
import type { default as WaInput } from "@awesome.me/webawesome/dist/components/input/input.js"
import { runtime } from "#app/modules/eeg"
import {
    FINDING_GROUPS,
    type OfferedFinding,
    findingGroupTag,
    findingLabel,
    findingPolicy,
    offeredFindings,
    paletteFindings,
    policyMismatch,
    recentFindings,
    rememberFinding,
    searchFindings,
} from "#app/modules/eeg/findings"
import {
    type FindingCode,
    type FindingValue,
    type Balance,
    type Laterality,
    type OfferedField,
    type RecordedFindingGroup,
    type ValueField,
    type ValueMode,
    VALUE_MODES,
    balanceOf,
    composeFindingCode,
    confineNumber,
    electrodesByRegion,
    groupsAllowed,
    isAcronym,
    offeredFields,
    lateralityOf,
    numericDomain,
    parseFindingCode,
    relationsAllowed,
    relocate,
    sensorLaterality,
    sensorsAllowed,
    setBalance,
    setLaterality,
    synonymFindings,
    valueText,
} from "#app/modules/eeg/findingProperties"
import type { FrequencyMeasurement } from "#app/views/biosignal/measurements"
import CANONICAL_ELECTRODES from "#app/modules/eeg/canonical-electrodes.json"
import { Log } from "scoped-event-log"

const SCOPE = 'FindingPicker'

/** The tag a measured frequency is written under. */
const FREQUENCY_TAG = 'Feature-frequency'

/**
 * A measured frequency to one decimal, as precise as the reader's markers make it.
 * @param hz - Frequency in Hz.
 */
const roundHz = (hz: number) => Math.round(hz*10)/10

/** The Browse menu's value for the finding groups already in the recording, which no term group's branch can be. */
const RECORDED_GROUPS = '#recorded-groups'

/** A finding group of the recording as the Browse menu lists it. */
type RecordedGroupEntry = {
    /** The finding the group's events code, as the group's earliest event writes it. */
    code: FindingCode
    /** The finding's picker group and how many events the group has. */
    description: string
    group: RecordedFindingGroup
    /** The finding's readable name. */
    label: string
}

/** A property shown as a removable chip. */
type PropertyChip = {
    key: string
    /** What the property is, by its field's name, for the remove button's tooltip. */
    kind: string
    label: string
    /** Removes the property from a code. */
    remove: (code: FindingCode) => void
}

/** Whether the property fields are shown; kept for the page, so a reader who opened them once finds them open. */
const _expanded = ref(false)

export default defineComponent({
    name: SCOPE,
    props: {
        /**
         * Saves the annotation and gives the other events of its finding group the same finding and properties, each
         * keeping its own location; offered at the end of the row when given and the finding is in a group.
         */
        applyToGroup: {
            type: Function as PropType<() => void>,
            default: null,
        },
        /**
         * Canonical labels of the electrodes the recording has, which the location is chosen from. Empty offers the
         * whole 10-10 table, for a recording whose electrodes are not known.
         */
        availableSensors: {
            type: Array as PropType<string[]>,
            default: () => [],
        },
        /** The finding's current HED string, empty when none is coded. */
        code: {
            type: String,
            default: '',
        },
        disabled: {
            type: Boolean,
            default: false,
        },
        /**
         * Moves focus to what follows a pick, such as the editor's save button. Without it the picker focuses its
         * own remove button, since the search field a pick replaces held the focus and an editor that loses it closes.
         */
        focusNext: {
            type: Function as PropType<() => void>,
            default: null,
        },
        /** How many other events are in the finding group of the annotation being edited. */
        groupMembers: {
            type: Number,
            default: 0,
        },
        /** A frequency measured within the annotation's span, filled in when a finding with a frequency is picked. */
        measuredFrequency: {
            type: Object as PropType<FrequencyMeasurement | null>,
            default: null,
        },
        /**
         * The finding groups already in the recording, which the event can join from the Browse menu. The event being
         * edited is not counted among their events.
         */
        recordedGroups: {
            type: Array as PropType<RecordedFindingGroup[]>,
            default: () => [],
        },
        /** Canonical labels of the electrodes the annotation is drawn on, its location when a finding is picked. */
        sensors: {
            type: Array as PropType<string[]>,
            default: () => [],
        },
        /** Saves the annotation and goes on stamping copies of it, offered at the end of the row when given. */
        stamp: {
            type: Function as PropType<() => void>,
            default: null,
        },
    },
    emits: ['change'],
    setup () {
        const clearbtn = ref<WaButton>() as Ref<WaButton>
        const group = ref('')
        const highlighted = ref(0)
        // The finding group of a finding removed to pick another, which the new pick stays in.
        const keptGroup = ref<number | null>(null)
        const index = shallowRef<HedScoreTermIndex | null>(null)
        const list = ref<HTMLDivElement>()
        const offered = shallowRef<OfferedFinding[]>([])
        const policy = shallowRef<HedScorePolicy | null>(null)
        const query = ref('')
        const search = ref<WaInput>() as Ref<WaInput>
        const state = ref<'hidden' | 'loading' | 'ready' | 'unavailable'>('loading')
        const statusMessage = ref('')
        const toggle = ref<HTMLButtonElement>()
        // The mode chosen per value field before its number is typed, or while a range has one bound.
        const chosenModes = ref<Record<string, ValueMode>>({})
        return {
            chosenModes,
            clearbtn,
            expanded: _expanded,
            group,
            groups: FINDING_GROUPS,
            highlighted,
            index,
            keptGroup,
            list,
            offered,
            policy,
            query,
            RECORDED_GROUPS,
            search,
            state,
            statusMessage,
            toggle,
        }
    },
    computed: {
        attribution (): string {
            return this.index?.attribution ?? ''
        },
        /** How the coded bilateral finding is balanced. */
        balance (): Balance {
            return this.parsed ? balanceOf(this.parsed) : ''
        },
        /**
         * The balances offered for a bilateral finding: a dominant side or symmetrical where comparisons are allowed,
         * else symmetrical or asymmetrical. A balance read back that is not offered is kept in the list.
         */
        balanceOptions (): { label: string, value: Balance }[] {
            const options = this.valueModes.length > 1
                ? [
                    { label: 'Left dominant', value: 'Left' as Balance },
                    { label: 'Right dominant', value: 'Right' as Balance },
                    { label: 'Symmetrical', value: 'symmetrical' as Balance },
                ]
                : [
                    { label: 'Symmetrical', value: 'symmetrical' as Balance },
                    { label: 'Asymmetrical', value: 'asymmetrical' as Balance },
                ]
            if (this.balance && !options.some(option => option.value === this.balance)) {
                options.push({ label: 'Asymmetrical', value: this.balance })
            }
            return options
        },
        /** The location has electrodes to set a maximum apart from, and the comparisons are allowed. */
        canCompareSensors (): boolean {
            return this.valueModes.length > 1 && (this.parsed?.sensors.length ?? 0) > 1
        },
        /** The location may be written under the host's policy. */
        canLocate (): boolean {
            return !!this.index && sensorsAllowed(this.index, this.policy)
        },
        /** What the code sets beside its finding, each removable on its own. */
        chips (): PropertyChip[] {
            if (!this.parsed) {
                return []
            }
            const chips = [] as PropertyChip[]
            const sideField = this.fields.find(field => field.key === 'side')
            const sideTags = new Set(sideField?.kind === 'choice' ? sideField.options.map(opt => opt.term.name) : [])
            if (this.laterality) {
                const balance = this.balanceOptions.find(option => option.value === this.balance)
                const side = this.lateralityOptions.find(option => option.value === this.laterality)!
                chips.push({
                    key: 'side',
                    kind: this.$t('Side'),
                    label: [side, balance].filter(part => part).map(part => this.$t(part!.label)).join(', '),
                    remove: code => {
                        setLaterality(code, '')
                    },
                })
            }
            for (const name of this.parsed.properties.filter(name => !sideTags.has(name))) {
                const field = this.fields.find(field => field.kind === 'choice' && (
                    field.options.some(option => option.term.name === name) || field.toggleOption?.term.name === name
                ))
                const option = field?.kind === 'choice'
                               ? field.options.find(option => option.term.name === name)
                                 ?? (field.toggleOption?.term.name === name ? field.toggleOption : undefined)
                               : undefined
                // An option named without its field's words reads as part of the field on a chip of its own.
                const shortened = option && option.label !== findingLabel(name)
                chips.push({
                    key: name,
                    kind: field ? this.$t(field.label) : findingLabel(name),
                    label: shortened
                           ? `${this.$t(field!.label)}: ${option.label.toLocaleLowerCase()}`
                           : findingLabel(name),
                    remove: code => {
                        code.properties = code.properties.filter(other => other !== name)
                    },
                })
            }
            for (const [tag, value] of Object.entries(this.parsed.values)) {
                const field = this.fields.find(field => field.kind === 'value' && field.tag === tag) as ValueField
                chips.push({
                    key: tag,
                    kind: field ? this.$t(field.label) : findingLabel(tag),
                    label: `${field ? this.$t(field.label) : findingLabel(tag)} ${valueText(value, field?.unit)}`,
                    remove: code => {
                        delete code.values[tag]
                    },
                })
            }
            if (this.parsed.sensors.length) {
                chips.push({
                    key: 'location',
                    kind: this.$t('Location'),
                    label: this.parsed.sensors.join(', '),
                    remove: code => {
                        relocate(code, [], this.hasSide)
                    },
                })
            }
            if (this.parsed.maxSensors?.length && this.canCompareSensors) {
                chips.push({
                    key: 'maximum',
                    kind: this.$t('Maximum'),
                    label: `${this.$t('Max')} ${this.parsed.maxSensors.join(', ')}`,
                    remove: code => {
                        delete code.maxSensors
                    },
                })
            }
            return chips
        },
        /**
         * The electrodes the location is chosen from: the recording's, in the standard's order, with any the stored
         * code names besides, so a location written elsewhere is shown rather than dropped.
         */
        electrodes (): string[] {
            const offered = new Set([...this.availableSensors, ...this.parsed?.sensors ?? []])
            if (!this.availableSensors.length) {
                return CANONICAL_ELECTRODES.electrodes
            }
            return [
                ...CANONICAL_ELECTRODES.electrodes.filter(label => offered.has(label)),
                ...[...offered].filter(label => !CANONICAL_ELECTRODES.electrodes.includes(label)),
            ]
        },
        /** The offered electrodes under their regions. */
        electrodeRegions (): { electrodes: string[], label: string }[] {
            return electrodesByRegion(this.electrodes)
        },
        /** Where the coded finding is. */
        laterality (): Laterality {
            return this.parsed ? lateralityOf(this.parsed) : ''
        },
        /** The sides offered; bilateral writes both. */
        lateralityOptions (): { label: string, value: Laterality }[] {
            return [
                { label: 'Left', value: 'Left' },
                { label: 'Right', value: 'Right' },
                { label: 'Bilateral', value: 'bilateral' },
            ]
        },
        /**
         * The rows of the property grid: the fields in their set's order, with the location after the side, or last
         * when the side is not offered. Each row may open with its field's heading.
         */
        rows (): { field: OfferedField | null, heading?: string, key: string }[] {
            const rows = [] as { field: OfferedField | null, heading?: string, key: string }[]
            let located = !this.canLocate
            for (const field of this.fields) {
                rows.push({ field, heading: field.heading, key: field.key })
                if (field.key === 'side' && !located) {
                    rows.push({ field: null, key: 'location' })
                    located = true
                }
            }
            if (!located) {
                rows.push({ field: null, key: 'location' })
            }
            return rows
        },
        /** The property fields of the coded finding. */
        fields (): OfferedField[] {
            if (!this.index || !this.parsed) {
                return []
            }
            return offeredFields(this.index, this.policy, this.parsed.finding)
        },
        /** The number of the finding group the coded finding is one occurrence of, or `null`. */
        findingGroup (): number | null {
            return this.parsed?.group ?? null
        },
        /** The coded finding is offered a side. */
        hasSide (): boolean {
            return this.fields.some(field => field.key === 'side')
        },
        /** The value modes the host's policy allows: the exact number only, unless it allows comparisons. */
        valueModes (): typeof VALUE_MODES {
            return relationsAllowed(this.policy) ? VALUE_MODES : VALUE_MODES.filter(mode => mode.mode === 'exact')
        },
        /** The stored string read back as a finding and its properties, `null` when the picker did not write it. */
        parsed (): FindingCode | null {
            return this.code && this.index ? parseFindingCode(this.code, this.index) : null
        },
        attributionShort (): string {
            return this.index ? `HED-SCORE ${this.index.schema.version} · CC BY 4.0` : ''
        },
        palette (): OfferedFinding[] {
            return paletteFindings(this.offered, runtime.hedScore.palette)
        },
        /** The recording's finding groups the Browse menu lists, while it is open on them and nothing is typed. */
        listedGroups (): RecordedGroupEntry[] {
            return !this.code && this.group === RECORDED_GROUPS && !this.query.trim() ? this.recordedEntries : []
        },
        /**
         * The recording's finding groups an event can join: those whose code the picker reads, where the host's policy
         * allows groups.
         */
        recordedEntries (): RecordedGroupEntry[] {
            if (!this.index || !groupsAllowed(this.index, this.policy)) {
                return []
            }
            const entries = [] as RecordedGroupEntry[]
            for (const group of this.recordedGroups) {
                const code = parseFindingCode(group.code, this.index)
                if (!code) {
                    continue
                }
                const tag = findingGroupTag(this.index.branchOf(code.finding) ?? '')
                const count = this.$t('{count} events', { count: group.members })
                entries.push({
                    code,
                    description: tag ? `${this.$t(tag)} · ${count}` : count,
                    group,
                    label: findingLabel(code.finding),
                })
            }
            return entries
        },
        results (): OfferedFinding[] {
            if (this.code) {
                return []
            }
            if (this.query.trim()) {
                // An abbreviation's finding ranks first, and is not listed a second time without its properties.
                const synonyms = synonymFindings(this.offered, this.query, this.index!, this.policy)
                const bare = new Set(synonyms.filter(found => !found.properties?.length).map(found => found.term.name))
                return [
                    ...synonyms,
                    ...searchFindings(this.offered, this.query, recentFindings()).filter(
                        found => !bare.has(found.term.name)
                    ),
                ]
            }
            if (this.group && this.group !== RECORDED_GROUPS) {
                return this.offered.filter(finding => finding.branch === this.group)
            }
            return []
        },
        selectedDescription (): string {
            return this.index?.getTerm(this.parsed?.finding ?? this.code)?.description ?? ''
        },
        /** The short name of the coded finding's group, so it is not taken for a namesake in another group. */
        selectedGroup (): string {
            const finding = this.parsed?.finding
            return finding && this.index ? findingGroupTag(this.index.branchOf(finding) ?? '') : ''
        },
        selectedLabel (): string {
            // A string the picker did not write is shown as stored.
            return this.parsed ? findingLabel(this.parsed.finding) : this.code
        },
    },
    // The result and palette buttons take no focus on press: a browser that does not focus a pressed button would
    // otherwise leave the editor with nothing focused, and an editor that loses focus closes before the click lands.
    methods: {
        /**
         * Override the default I18n translate method.
         * Returns a component-specific translation (default) or a
         * general translation (fallback) for the given key string.
         */
        $t: function (key: string, params = {}, capitalized = false) {
            return T(key, this.$options.name, params, capitalized)
        },
        /**
         * The selected tags of a choice field, as its select takes them.
         * @param field - The field.
         */
        choiceValue (field: OfferedField) {
            if (field.kind !== 'choice' || !this.parsed) {
                return field.kind === 'choice' && field.multiple ? [] : ''
            }
            const names = new Set(field.options.map(option => option.term.name))
            const chosen = this.parsed.properties.filter(name => names.has(name))
            return field.multiple ? chosen : chosen[0] ?? ''
        },
        clear () {
            this.chosenModes = {}
            this.keptGroup = this.parsed?.group ?? null
            this.$emit('change', null)
            this.$nextTick(() => {
                this.search?.focus()
            })
        },
        /**
         * The range and step a value field's inputs take, from the domain the platform accepts its number in.
         * @param field - The field.
         */
        domainOf (field: OfferedField) {
            const domain = field.kind === 'value' ? numericDomain(field.tag) : undefined
            return domain
                ? { high: domain.high, low: domain.low, step: 10**-domain.decimals }
                : { high: undefined, low: 0, step: 'any' as const }
        },
        handleListKeydown (event: KeyboardEvent) {
            this.navigateResults(event)
        },
        handleSearchKeydown (event: KeyboardEvent) {
            if (this.navigateResults(event)) {
                return
            }
            if (event.key === 'Escape' && (this.query || this.group)) {
                event.preventDefault()
                this.query = ''
                this.group = ''
            } else if (/^[0-9]$/.test(event.key) && !this.query && this.palette.length) {
                // The number keys pick from the palette while nothing has been typed; no term starts with a digit.
                const finding = this.palette[(Number(event.key) + 9)%10]
                if (finding) {
                    event.preventDefault()
                    this.pick(finding)
                }
            }
        },
        /**
         * The short name of a finding's group, translated, so it is not taken for a namesake in another group.
         * @param finding - An offered finding.
         */
        groupTag (finding: OfferedFinding) {
            const tag = findingGroupTag(finding.branch)
            return tag ? this.$t(tag) : ''
        },
        /**
         * Highlight the result under the pointer. Bound to pointer movement rather than entry, so a list scrolled
         * under a still pointer by the arrow keys keeps the keyboard's highlight.
         * @param idx - Index of the result.
         */
        highlightResult (idx: number) {
            if (this.highlighted !== idx) {
                this.highlighted = idx
            }
        },
        async load () {
            try {
                const [index, policy] = await Promise.all([
                    loadHedScoreIndex(),
                    findingPolicy(runtime.hedScore.policy),
                ])
                this.index = index
                if (runtime.hedScore.policy && !policy) {
                    // The host's server takes no HED codes.
                    this.state = 'hidden'
                    return
                }
                const mismatch = policyMismatch(index, policy)
                if (mismatch) {
                    this.statusMessage = mismatch === 'version'
                        ? this.$t(
                            'The server validates findings against HED-SCORE {server}; this viewer has {viewer}.',
                            { server: policy!.schema.version, viewer: index.schema.version },
                        )
                        : this.$t(
                            'The server and this viewer have different copies of HED-SCORE {version}.',
                            { version: index.schema.version },
                        )
                    this.state = 'unavailable'
                    return
                }
                this.policy = policy
                this.offered = offeredFindings(index, policy)
                this.state = 'ready'
            } catch (e) {
                Log.error(`Could not load the finding terms.`, SCOPE, e as Error)
                this.statusMessage = this.$t('Findings cannot be coded right now.')
                this.state = 'unavailable'
            }
        },
        /** Take the event out of its finding group; the rest of the group stays as it is. */
        leaveGroup () {
            // The button goes with the group, and the focus it holds would fall to the document, which the editor
            // takes for the user leaving it. The clear button stays, so the focus moves there first.
            this.clearbtn?.focus()
            this.keptGroup = null
            this.update(code => {
                delete code.group
            })
        },
        /**
         * Move the highlight through the results, or pick the highlighted one, for a key pressed in the search field
         * or the list. Returns whether the key was one of these.
         * @param event - The key event.
         */
        navigateResults (event: KeyboardEvent) {
            const count = this.listedGroups.length || this.results.length
            if (!count) {
                return false
            }
            let next = this.highlighted
            if (event.key === 'ArrowDown') {
                next = (this.highlighted + 1)%count
            } else if (event.key === 'ArrowUp') {
                next = (this.highlighted - 1 + count)%count
            } else if (event.key === 'Home') {
                next = 0
            } else if (event.key === 'End') {
                next = count - 1
            } else if (event.key === 'Enter') {
                event.preventDefault()
                const idx = Math.min(this.highlighted, count - 1)
                if (this.listedGroups.length) {
                    this.pickGroup(this.listedGroups[idx])
                } else {
                    this.pick(this.results[idx])
                }
                return true
            } else {
                return false
            }
            event.preventDefault()
            this.highlighted = next
            this.$nextTick(() => {
                this.list?.children[next]?.scrollIntoView({ block: 'nearest' })
            })
            return true
        },
        pick (finding: OfferedFinding) {
            rememberFinding(finding.term.name)
            this.query = ''
            this.group = ''
            this.highlighted = 0
            const fields = offeredFields(this.index!, this.policy, finding.term.name)
            const code: FindingCode = {
                finding: finding.term.name,
                properties: [...finding.properties ?? []],
                sensors: this.canLocate ? [...this.sensors] : [],
                values: {},
            }
            if (fields.some(field => field.key === 'side')) {
                setLaterality(code, sensorLaterality(code.sensors))
            }
            if (this.keptGroup !== null) {
                code.group = this.keptGroup
            }
            if (this.measuredFrequency && fields.some(field => field.kind === 'value' && field.tag === FREQUENCY_TAG)) {
                // A frequency read off markers is a mean over uneven intervals, so it is approximate where allowed.
                code.values[FREQUENCY_TAG] = {
                    mode: this.valueModes.length > 1 ? 'about' : 'exact',
                    value: roundHz(this.measuredFrequency.mean),
                }
            }
            this.chosenModes = {}
            this.$emit('change', composeFindingCode(code, fields))
            if (this.focusNext) {
                this.focusNext()
                return
            }
            this.$nextTick(() => {
                this.clearbtn?.focus()
            })
        },
        /**
         * Join a finding group of the recording: the event takes the finding and properties of the group's earliest
         * event, moved to its own location as a copy is, and the group's number.
         * @param entry - The group, as the Browse menu lists it.
         */
        pickGroup (entry: RecordedGroupEntry) {
            this.query = ''
            this.group = ''
            this.highlighted = 0
            const code = { ...entry.code, properties: [...entry.code.properties], values: { ...entry.code.values } }
            const fields = offeredFields(this.index!, this.policy, code.finding)
            if (this.canLocate) {
                relocate(code, this.sensors, fields.some(field => field.key === 'side'))
            }
            code.group = entry.group.number
            this.chosenModes = {}
            this.$emit('change', composeFindingCode(code, fields))
            if (this.focusNext) {
                this.focusNext()
                return
            }
            this.$nextTick(() => {
                this.clearbtn?.focus()
            })
        },
        /**
         * How a value field's number is meant: as chosen while it is being entered, else as it is written.
         * @param field - The field.
         */
        modeOf (field: OfferedField): ValueMode {
            if (field.kind !== 'value') {
                return 'exact'
            }
            return this.chosenModes[field.tag] ?? this.parsed?.values[field.tag]?.mode ?? 'exact'
        },
        /**
         * Remove one property from the code, keeping focus in the picker.
         * @param chip - The property's chip.
         */
        removeChip (chip: PropertyChip) {
            this.update(chip.remove)
            this.$nextTick(() => {
                this.toggle?.focus()
            })
        },
        /**
         * The remove button's label for a chip, naming what kind of property it removes.
         * @param chip - The property's chip.
         */
        removeLabel (chip: PropertyChip) {
            return this.$t('Remove {property}', { property: chip.kind.toLocaleLowerCase() })
        },
        /**
         * A palette entry's tooltip: its group, which the entry has no room to show, and its description.
         * @param finding - The palette entry.
         */
        paletteTitle (finding: OfferedFinding) {
            return [this.groupTag(finding), finding.term.description ?? ''].filter(part => part).join(': ')
        },
        /**
         * A result's tooltip: its full name, which a narrow list cuts short, and its description.
         * @param finding - The result.
         */
        resultTitle (finding: OfferedFinding) {
            return [finding.label, finding.term.description ?? ''].filter(part => part).join('\n\n')
        },
        /**
         * A key for a result that tells an abbreviation's entry from the plain term.
         * @param finding - The result.
         */
        resultKey (finding: OfferedFinding) {
            return [finding.term.name, finding.abbreviation ?? '', ...finding.properties ?? []].join('|')
        },
        selectGroup (branch: string) {
            this.group = branch || ''
            this.query = ''
            this.highlighted = 0
            if (this.group) {
                // Into the group's list, so the arrow keys move through it rather than reopening the menu.
                this.$nextTick(() => {
                    this.list?.focus()
                })
            }
        },
        /**
         * Set the tags of a choice field, replacing what it had chosen.
         * @param field - The field.
         * @param value - The tag, or the tags of a multiple field; empty to clear.
         */
        setChoice (field: OfferedField, value: string | string[]) {
            if (field.kind !== 'choice') {
                return
            }
            const names = new Set(field.options.map(option => option.term.name))
            const chosen = (Array.isArray(value) ? value : [value]).filter(name => names.has(name))
            this.update(code => {
                code.properties = [...code.properties.filter(name => !names.has(name)), ...chosen]
            })
        },
        /**
         * Set the electrodes of the location the finding is greatest at.
         * @param value - Canonical electrode labels, among the location's.
         */
        setMaxSensors (value: string[] | string) {
            const chosen = (Array.isArray(value) ? value : [value]).filter(label => label)
            this.update(code => {
                const max = code.sensors.filter(label => chosen.includes(label))
                if (max.length) {
                    code.maxSensors = max
                } else {
                    delete code.maxSensors
                }
            })
        },
        /**
         * Set the location.
         * @param value - Canonical electrode labels.
         */
        setSensors (value: string[] | string) {
            const chosen = (Array.isArray(value) ? value : [value]).filter(label => label)
            this.update(code => {
                relocate(code, this.electrodes.filter(label => chosen.includes(label)), this.hasSide)
            })
        },
        /**
         * Set where the finding is.
         * @param value - Left, right, bilateral, or empty to clear.
         */
        setSide (value: Laterality) {
            this.update(code => {
                setLaterality(code, value || '')
            })
        },
        /**
         * Set how a bilateral finding is balanced.
         * @param value - The balance, or empty to clear.
         */
        setSideBalance (value: Balance) {
            this.update(code => {
                setBalance(code, value || '')
            })
        },
        /**
         * Add or remove a field's checkbox tag.
         * @param field - The field.
         * @param checked - Whether the tag is to be written.
         */
        setToggle (field: OfferedField, checked: boolean) {
            const tag = field.kind === 'choice' ? field.toggleOption?.term.name : undefined
            if (!tag) {
                return
            }
            this.update(code => {
                code.properties = code.properties.filter(name => name !== tag)
                if (checked) {
                    code.properties.push(tag)
                }
            })
        },
        /**
         * Set a number of a value field. An empty or unreadable entry removes the value, or a range's upper bound;
         * bounds entered the wrong way round are swapped.
         * @param field - The field.
         * @param bound - The number, or a range's upper bound.
         * @param entry - What the reader entered.
         */
        setValue (field: OfferedField, bound: 'upper' | 'value', entry: string) {
            if (field.kind !== 'value') {
                return
            }
            const entered = Number(entry)
            const valid = entry.trim() !== '' && Number.isFinite(entered)
            // Rounded and held to the tag's domain here, so the field shows the number that will be written.
            const number = valid ? confineNumber(field.tag, entered) ?? entered : entered
            const mode = this.modeOf(field)
            this.update(code => {
                const current = code.values[field.tag]
                if (bound === 'value' && !valid) {
                    delete code.values[field.tag]
                    return
                }
                if (bound === 'upper') {
                    if (current) {
                        code.values[field.tag] = valid
                            ? { mode, upper: number, value: current.value }
                            : { mode, value: current.value }
                    }
                } else {
                    code.values[field.tag] = mode === 'range' && current?.upper !== undefined
                        ? { mode, upper: current.upper, value: number }
                        : { mode, value: number }
                }
                const value = code.values[field.tag]
                if (value?.upper !== undefined && value.upper < value.value) {
                    code.values[field.tag] = { mode, upper: value.value, value: value.upper }
                }
            })
        },
        /**
         * Change how a value field's number is meant. A range opened on a measured frequency takes the measured
         * bounds; one opened on a number starts at it.
         * @param field - The field.
         * @param mode - The new mode.
         */
        setValueMode (field: OfferedField, mode: ValueMode) {
            if (field.kind !== 'value' || !mode) {
                return
            }
            this.chosenModes = { ...this.chosenModes, [field.tag]: mode }
            const current = this.parsed?.values[field.tag]
            if (!current && !(mode === 'range' && this.measuredFrequency && field.tag === FREQUENCY_TAG)) {
                return
            }
            this.update(code => {
                let next: FindingValue = { mode, value: current?.value ?? 0 }
                if (mode === 'range') {
                    next = this.measuredFrequency && field.tag === FREQUENCY_TAG
                        ? {
                            mode,
                            upper: roundHz(this.measuredFrequency.max),
                            value: roundHz(this.measuredFrequency.min),
                        }
                        : { mode, upper: current!.upper ?? current!.value, value: current!.value }
                }
                code.values[field.tag] = next
            })
        },
        toggleProperties () {
            this.expanded = !this.expanded
        },
        /**
         * Whether a result shows the abbreviation it was found by: only an acronym, whose match its name does not
         * explain, where a word form such as "polyspike" is spelled out in the name already.
         * @param finding - The result.
         */
        showsAbbreviation (finding: OfferedFinding) {
            return !!finding.abbreviation && isAcronym(finding.abbreviation)
        },
        /**
         * Change the coded finding and emit the string it is written as.
         * @param change - Changes a copy of the parsed code.
         */
        update (change: (code: FindingCode) => void) {
            if (!this.parsed) {
                return
            }
            const code = {
                ...this.parsed,
                properties: [...this.parsed.properties],
                sensors: [...this.parsed.sensors],
                ...(this.parsed.maxSensors ? { maxSensors: [...this.parsed.maxSensors] } : {}),
                values: { ...this.parsed.values },
            }
            change(code)
            this.$emit('change', composeFindingCode(code, this.fields))
        },
        updateQuery (value: string) {
            this.query = value
            this.highlighted = 0
        },
    },
    beforeMount () {
        // Add component styles to shadow root
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    mounted () {
        this.load()
    },
})
</script>

<style scoped>
[data-component="finding-picker"] {
    /* The fields below the row start where its field does, past the icon: margin, fixed icon width, margin. */
    --finding-icon-width: 1.25rem;
    --finding-indent: calc(0.25rem + var(--finding-icon-width) + 0.5rem);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
    padding-top: 0.25rem;
}
.row {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
}
    .row .icon {
        flex: 0 0 var(--finding-icon-width);
        width: var(--finding-icon-width);
        font-size: 1rem;
        margin: auto 0.5rem auto 0.25rem;
        color: var(--epicv-icon-default);
    }
    .row wa-input,
    .row .selected {
        flex: 1 1 0;
    }
    .row wa-input{
        margin-right: 0.25rem;
    }
    .row wa-select {
        flex: 0 0 12rem;
    }
    .row .apply,
    .row .stamp {
        margin-left: 0.25rem;
    }
    .row .apply wa-icon,
    .row .stamp wa-icon {
        font-size: 1rem;
    }
.selected {
    display: flex;
    align-items: center;
    min-height: 1.75rem;
    padding-left: 0.5rem;
    background-color: var(--epicv-background-focus);
    border: solid 1px var(--epicv-border);
    border-radius: 0.25rem;
    color: var(--epicv-text-emphasis);
}
    .selected .label {
        flex: 1 1 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .selected--readonly {
        padding-right: 0.5rem;
    }
.properties {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-left: var(--finding-indent);
}
.chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
}
.chip,
.toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    border: solid 1px var(--epicv-border);
    border-radius: 0.25rem;
    color: inherit;
    font: inherit;
}
    .chip {
        padding-right: 0.125rem;
        background-color: var(--epicv-background-focus);
    }
    .chip-remove {
        display: inline-flex;
        padding: 0.125rem;
        border: none;
        border-radius: 0.25rem;
        background: none;
        color: inherit;
        font-size: 0.75rem;
        opacity: 0.6;
        cursor: pointer;
    }
    .chip-remove:hover {
        opacity: 1;
    }
    .toggle {
        flex: 1 1 auto;
        justify-content: flex-start;
        text-align: left;
        border-color: transparent;
        background: none;
        opacity: 0.8;
        cursor: pointer;
    }
    .toggle:hover {
        background-color: var(--epicv-background-hover);
    }
.toggle-field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
    .toggle-field wa-select,
    .toggle-field wa-checkbox {
        flex: 1 1 0;
        min-width: 0;
    }
.side-field {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}
    .side-field wa-select {
        flex: 1 1 0;
        min-width: 0;
    }
.value-field {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}
    .value-field .mode {
        flex: 0 0 4rem;
    }
    .value-field wa-input {
        flex: 1 1 0;
        min-width: 0;
    }
.region {
    display: block;
    padding: 0.125rem 0.5rem;
    background-color: var(--epicv-background-highlight);
}
.fields .heading {
    grid-column: 1 / -1;
    margin: 0.5rem 0 0.25rem;
    color: var(--epicv-text-minor);
    font-weight: 600;
}
.fields {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    align-items: center;
    gap: 0.25rem 0.5rem;
}
/* The divider before the recording's finding groups, kept close to the options around it. */
.browse-divider {
    --spacing: var(--wa-space-xs);
}
.results {
    display: flex;
    flex-direction: column;
    max-height: 12rem;
    margin-left: var(--finding-indent);
    overflow-y: auto;
    border: solid 1px var(--epicv-border);
    border-radius: 0.25rem;
}
    .results:focus {
        outline: none;
    }
    .results:focus-visible {
        border-color: var(--epicv-border-focus);
    }
.result {
    /* Rows take the height of their text and the list scrolls. The native button styles give a button the height of a
       form control, which a list of one-line rows does not want. */
    flex: 0 0 auto;
    display: flex;
    align-items: baseline;
    height: auto;
    min-height: 0;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border: none;
    background-color: var(--epicv-background);
    border-radius: 0;
    color: inherit;
    font: inherit;
    line-height: 1.125;
    text-align: left;
    cursor: pointer;
}
    .result .result-label {
        flex: 1 1 0;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .result .abbreviation,
    .result .number {
        margin-right: 0.25rem;
        font-weight: 600;
    }
    .result .number {
        font-variant-numeric: tabular-nums;
    }
    .result .group,
    .selected .group {
        flex: 0 0 auto;
        color: var(--epicv-text-minor);
        font-size: 0.75rem;
    }
    .selected .group {
        margin-left: 0.5rem;
    }
    .selected .finding-group {
        flex: 0 0 auto;
        margin-left: 0.5rem;
        color: var(--epicv-text-minor);
        font-size: 0.75rem;
        font-variant-numeric: tabular-nums;
    }
    .result:hover,
    .result--active {
        background-color: var(--epicv-background-hover);
    }
.palette {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-left: var(--finding-indent);
}
.palette-item {
    padding: 0.125rem 0.5rem;
    border: solid 1px var(--epicv-border);
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
}
    .palette-item:hover {
        background-color: var(--epicv-background-hover);
    }
    .palette-item .key {
        margin-right: 0.25rem;
        opacity: 0.6;
    }
.status {
    margin-left: var(--finding-indent);
    opacity: 0.8;
}
.attribution {
    margin-left: var(--finding-indent);
    font-size: 0.75rem;
    opacity: 0.6;
}
</style>
