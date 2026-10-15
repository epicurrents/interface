<template>
    <wa-dialog ref="dialog"
        class="epicv-dialog"
        data-component="signal-export-dialog"
        :label="title"
        :open="open"
        @wa-close="closeDialog"
    >
        <!-- Everything but the footer scrolls, inside the height the dialog leaves it. -->
        <wa-scroller orientation="vertical">
            <p v-if="!resource" class="epicv-text-faint">{{ $t('There is no recording to export.') }}</p>
            <template v-else>
                <!-- The target's switch, set first: it decides which constraints the rest of the dialog is held to. -->
                <wa-switch v-if="target?.toggle"
                    class="toggle"
                    :checked="toggleOn"
                    :disabled="busy"
                    size="s"
                    @input="setToggle($event.target.checked)"
                >{{ target.toggle.label }}</wa-switch>
                <!-- Range -->
                <h3>{{ $t('Range') }}</h3>
                <div class="row">
                    <wa-input
                        :label="$t('Start (s)')"
                        :max="String(maxStart)"
                        min="0"
                        required
                        size="s"
                        type="number"
                        v-property="['start', commitStart]"
                    ></wa-input>
                    <wa-select v-if="durations.length"
                        :label="$t('Length (s)')"
                        required
                        size="s"
                        :value="String(length)"
                        @change="setLength($event.target.value)"
                        @wa-after-hide.stop=""
                        @wa-hide.stop=""
                    >
                        <wa-option v-for="duration in durations"
                            :key="`duration-${duration}`"
                            :disabled="!fits(start, duration)"
                            :value="String(duration)"
                        >{{ duration }}</wa-option>
                    </wa-select>
                    <wa-input v-else
                        :label="$t('Length (s)')"
                        :max="String(maxLength)"
                        min="0"
                        required
                        size="s"
                        type="number"
                        v-property="['length', commitLength]"
                    ></wa-input>
                </div>
                <small class="epicv-text-faint">
                    {{ $t('The recording is {duration} s long.', { duration: formatNumber(resource.totalDuration) }) }}
                </small>
                <!-- Channels -->
                <h3>{{ $t('Channels') }}</h3>
                <table class="channels">
                    <thead>
                        <tr>
                            <th v-if="!fixedChannels"></th>
                            <th>{{ $t('Output label') }}</th>
                            <th>{{ $t('Source channel') }}</th>
                            <th v-if="!fixedChannels"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(row, index) in rows" :key="`channel-row-${index}`">
                            <td v-if="!fixedChannels">
                                <wa-checkbox
                                    :checked="row.include"
                                    size="s"
                                    @change="setInclude(index, $event.target.checked)"
                                ></wa-checkbox>
                            </td>
                            <td>
                                <span v-if="fixedChannels">{{ row.label }}</span>
                                <wa-input v-else
                                    :disabled="!row.include"
                                    size="s"
                                    :value="row.label"
                                    @change="setLabel(index, $event.target.value)"
                                ></wa-input>
                            </td>
                            <td>
                                <wa-select v-if="fixedChannels"
                                    :class="{ warning: row.source < 0 }"
                                    :placeholder="$t('Select a channel')"
                                    size="s"
                                    :value="row.source >= 0 ? String(row.source) : ''"
                                    @change="setSource(index, $event.target.value)"
                                    @wa-after-hide.stop=""
                                    @wa-hide.stop=""
                                >
                                    <wa-option v-for="source in signalSources"
                                        :key="`channel-${index}-source-${source.index}`"
                                        :value="String(source.index)"
                                    >{{ source.label }}</wa-option>
                                </wa-select>
                                <span v-else>{{ sources[row.source]?.label }}</span>
                            </td>
                            <td v-if="!fixedChannels" class="order">
                                <wa-button
                                    appearance="plain"
                                    :disabled="index === 0"
                                    size="s"
                                    @click="moveRow(index, -1)"
                                >
                                    <app-icon :label="$t('Move up')" name="chevron-up"></app-icon>
                                </wa-button>
                                <wa-button
                                    appearance="plain"
                                    :disabled="index === rows.length - 1"
                                    size="s"
                                    @click="moveRow(index, 1)"
                                >
                                    <app-icon :label="$t('Move down')" name="chevron-down"></app-icon>
                                </wa-button>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <!-- Sample properties -->
                <h3>{{ $t('Sample properties') }}</h3>
                <p v-if="constraints?.samplingRate !== undefined">
                    {{ $t('Signals are resampled to {rate} Hz, as the destination requires.', { rate: constraints.samplingRate }) }}
                </p>
                <div v-else class="row">
                    <wa-input
                        :label="$t('Common sampling rate (Hz)')"
                        :max="maxRate === null ? undefined : String(maxRate)"
                        min="1"
                        :placeholder="$t('Use source channel rates')"
                        size="s"
                        type="number"
                        v-property="['rate', commitRate]"
                    ></wa-input>
                </div>
                <p v-if="constraints?.amplitudeRange">
                    {{ $t('Samples are clipped to {min} … {max} {unit} with {resolution} {unit} resolution.', {
                        min: constraints.amplitudeRange[0],
                        max: constraints.amplitudeRange[1],
                        unit: constraints.unit || '',
                        resolution: constraints.resolution || '',
                    }) }}
                </p>
                <!-- Summary -->
                <h3>{{ $t('Summary') }}</h3>
                <p v-if="deidentified" class="epicv-text-faint">
                    {{ $t('The file is de-identified: subject identifiers are blanked and annotation text is removed.') }}
                </p>
                <p v-if="sidecarIdentified" class="warning">
                    {{ $t('The metadata sent with the file is not de-identified and carries the original subject details.') }}
                </p>
                <template v-if="problems.length">
                    <p v-for="(problem, index) in problems" :key="`problem-${index}`"
                        class="problem"
                    >{{ problem }}</p>
                </template>
            </template>
        </wa-scroller>
        <wa-button slot="footer"
            appearance="plain"
            @click="closeDialog"
        >
            {{ $t('Cancel') }}
        </wa-button>
        <wa-button slot="footer"
            appearance="filled-outlined"
            :disabled="!canExport"
            :loading="busy"
            variant="brand"
            @click="runExport"
        >
            {{ target ? $t('Send') : $t('Export') }}
        </wa-button>
    </wa-dialog>
</template>

<script lang="ts">
/**
 * Export dialog for the active signal recording: a range, an ordered set of channels under output labels and an
 * output rate, built into a `SignalExportSelection` for an exporter. When the export goes to a registered
 * `SignalExportTarget`, the target's constraints pre-fill and lock the choices they fix and the selection is checked
 * against them before anything is encoded.
 */
import { defineComponent, PropType, ref } from "vue"
import { T } from "#i18n"
import { checkExportSelection, exportTargetMode, suggestExportSource } from "@epicurrents/core/util"
import type {
    BiosignalResource,
    EpicurrentsApp,
    SignalExportConstraints,
    SignalExportSelection,
    SignalExportSourceChannel,
    SignalExportTarget,
    SignalExportTargetMode,
} from "@epicurrents/core/types"
import AppIcon from '#app/AppIcon.vue'

/** What the dialog was opened for: a registered exporter to save a file with, or a registered export target. */
export type SignalExportRequest = {
    /** Name of the study exporter, when exporting to a file. */
    protocol?: string
    /** Name of the export target, when sending to one. */
    target?: string
}
/** The structural subset of an exporter the dialog calls. */
type SignalFileExporter = {
    /** The integer range samples are written in, for a format that scales them; see `FileFormatExporter`. */
    digitalRange?: [number, number]
    exportActiveResource?: (options?: Record<string, unknown>) => Promise<{
        edf: ArrayBuffer, fileName: string, sidecar: string
    } | null>
    format?: string
}
/** One output channel row. */
type ChannelRow = {
    /** Is the row exported (always true for a destination's fixed channel list). */
    include: boolean
    /** Output label. */
    label: string
    /** Index of the source channel in the recording's channel list, or -1 when none is chosen. */
    source: number
}

export default defineComponent({
    name: 'SignalExportDialog',
    components: {
        AppIcon,
    },
    props: {
        open: {
            type: Boolean,
            default: false,
        },
        request: {
            type: Object as PropType<SignalExportRequest | null>,
            default: null,
        },
    },
    emits: ['close', 'exported-file', 'sent'],
    setup () {
        const busy = ref(false)
        const length = ref(0)
        const rate = ref<number | null>(null)
        const rows = ref<ChannelRow[]>([])
        const start = ref(0)
        /**
         * The recording whose start the person set by hand. Until they do, the start follows the view; once they
         * have, it stays where they put it, across reopening the dialog, for as long as the same recording is active.
         */
        const startSetFor = ref<string | null>(null)
        /** The state of the target's toggle, where it has one; reset to the toggle's initial state on opening. */
        const toggleOn = ref(true)
        return {
            busy,
            length,
            rate,
            rows,
            start,
            startSetFor,
            toggleOn,
        }
    },
    computed: {
        app (): EpicurrentsApp | null {
            return window.__EPICURRENTS__.APP as EpicurrentsApp | null
        },
        canExport (): boolean {
            return !this.busy && !!this.resource && !!this.exporter?.exportActiveResource && !this.problems.length
        },
        /**
         * The constraints in effect, with the sample resolution an amplitude range gives where the exporter writes
         * scaled integers: the physical span over the digital span. Rounded to 12 significant digits, which keeps every
         * digit a double carries meaningfully and drops the noise of the division.
         */
        constraints (): SignalExportConstraints & { resolution?: number } | undefined {
            const constraints = this.mode?.constraints
            if (!constraints) {
                return undefined
            }
            const digitalRange = this.exporter?.digitalRange
            if (!constraints.amplitudeRange || !digitalRange) {
                return constraints
            }
            const [min, max] = constraints.amplitudeRange
            const resolution = Number(((max - min)/(digitalRange[1] - digitalRange[0])).toPrecision(12))
            return { ...constraints, resolution }
        },
        deidentified (): boolean {
            return this.exportOptions.deidentify !== false
        },
        durations (): number[] {
            return this.constraints?.durations || []
        },
        exporter (): SignalFileExporter | null {
            const exporters = this.$store.state.APP.studyExporters
            if (this.request?.protocol) {
                return exporters.get(this.request.protocol)?.loader?.studyExporter as SignalFileExporter | null
            }
            if (!this.target || !this.resource) {
                return null
            }
            for (const context of exporters.values()) {
                const exporter = context.loader?.studyExporter as SignalFileExporter | null
                if (exporter?.format === this.target.format && context.modalities.includes(this.resource.modality)) {
                    return exporter
                }
            }
            return null
        },
        /**
         * Options for the exporter. A file and, for a target, its sidecar are de-identified unless the target says
         * otherwise; the selection is always the dialog's, and the metadata keys the target's constraints forbid are
         * always removed, on top of any the target's own options name.
         */
        exportOptions (): Record<string, unknown> {
            const defaults = this.target ? { deidentify: true, deidentifySidecar: true } : { deidentify: true }
            const options = { ...defaults, ...(this.mode?.options || {}), selection: this.selection } as
                Record<string, unknown>
            const forbidden = this.constraints?.forbiddenMetadataKeys || []
            if (forbidden.length) {
                const named = Array.isArray(options.removeMetadataKeys) ? options.removeMetadataKeys as string[] : []
                options.removeMetadataKeys = [...new Set([...named, ...forbidden])]
            }
            return options
        },
        fixedChannels (): boolean {
            return !!this.constraints?.channels?.length
        },
        interruptions (): [number, number][] {
            return (this.resource?.interruptions || []).map(
                ({ start, duration }): [number, number] => [start, duration]
            )
        },
        /** How the target exports in its toggle's current state; null when exporting to a file. */
        mode (): SignalExportTargetMode | null {
            return this.target ? exportTargetMode(this.target, this.toggleOn) : null
        },
        /** The latest start from which the shortest permitted length still fits in the recording. */
        /**
         * The highest output rate the selection allows, in whole hertz: the slowest selected source channel's, since
         * an export only ever downsamples. Null while no channel is selected.
         */
        maxRate (): number | null {
            const rates = this.rows
                .filter(row => row.include && row.source >= 0)
                .map(row => this.sources[row.source]?.samplingRate ?? 0)
                .filter(rate => rate > 0)
            return rates.length ? Math.floor(Math.min(...rates)) : null
        },
        /** The longest free length from the current start, in whole milliseconds. */
        maxLength (): number {
            return Math.max(0, Math.floor(((this.resource?.totalDuration || 0) - this.start)*1000)/1000)
        },
        maxStart (): number {
            const total = this.resource?.totalDuration || 0
            const shortest = this.durations.length ? Math.min(...this.durations) : 0
            return Math.max(0, Math.floor((total - shortest)*1000)/1000)
        },
        problems (): string[] {
            if (!this.resource) {
                return []
            }
            const problems = [] as string[]
            if (!this.exporter?.exportActiveResource) {
                problems.push(this.$t('No exporter is available for this recording.'))
            }
            const unresolved = this.rows.filter(row => row.include && row.source < 0)
            if (unresolved.length) {
                problems.push(this.$t('Choose a source channel for {labels}.', {
                    labels: unresolved.map(row => row.label).join(', ')
                }))
            }
            if (this.selection.samplingRate !== undefined && !Number.isInteger(this.selection.samplingRate)) {
                problems.push(this.$t('The output rate must be a whole number of hertz.'))
            }
            for (const violation of checkExportSelection(
                this.sources, this.interruptions, this.selection, this.constraints
            )) {
                problems.push(violation.message)
            }
            return problems
        },
        resource (): BiosignalResource | null {
            if (!this.request) {
                return null
            }
            const resource = this.$store.state.APP.activeDataset?.activeResources[0] as BiosignalResource | undefined
            return resource?.channels ? resource : null
        },
        selection (): SignalExportSelection {
            const selection = {
                channels: this.rows.filter(row => row.include && row.source >= 0).map(row => ({
                    label: row.label,
                    source: row.source,
                })),
                range: [this.start, this.start + this.length],
            } as SignalExportSelection
            const rate = this.constraints?.samplingRate ?? this.rate
            if (rate !== null && rate !== undefined) {
                selection.samplingRate = rate
            }
            if (this.constraints?.amplitudeRange) {
                selection.amplitudeRange = [...this.constraints.amplitudeRange]
            }
            return selection
        },
        sidecarIdentified (): boolean {
            return !!this.mode?.sidecar && this.exportOptions.deidentifySidecar === false
        },
        signalSources (): { index: number, label: string }[] {
            return this.sources
                .map((source, index) => ({ index, label: source.label, source }))
                .filter(({ source }) => source.modality !== 'meta' && source.samplingRate > 0)
        },
        sources (): SignalExportSourceChannel[] {
            return (this.resource?.channels || []).map(channel => ({
                label: channel.label,
                modality: channel.modality,
                name: channel.name,
                sampleCount: channel.sampleCount,
                samplingRate: channel.samplingRate,
                unit: channel.unit,
            }))
        },
        summary (): string {
            const count = this.selection.channels?.length || 0
            const rate = this.selection.samplingRate !== undefined
                         ? this.$t('{rate} Hz', { rate: this.selection.samplingRate })
                         : this.$t('the source rates')
            return this.$t('Channels: {count}. Length: {length} s. Sampling rate: {rate}.', {
                count, length: this.formatNumber(this.length), rate,
            })
        },
        target (): SignalExportTarget | null {
            if (!this.request?.target || !this.resource || !this.app) {
                return null
            }
            // The application hands out only the targets the resource may be sent to.
            return this.app.getSignalExportTargets(this.resource).get(this.request.target) || null
        },
        title (): string {
            return this.target
                   ? this.$t('Send to {label}', { label: this.target.label })
                   : this.$t('Export recording')
        },
        viewStart (): number {
            return this.resource?.viewStart || 0
        },
    },
    watch: {
        open (value: boolean) {
            if (value) {
                this.initialise()
            }
        },
        viewStart () {
            if (this.open) {
                this.followView()
            }
        },
    },
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
         * The free length the person entered, held between zero and the rest of the recording from the start. A
         * cleared field takes the rest of the recording.
         * @param value - The length entered, in seconds; NaN when cleared.
         */
        commitLength (value: unknown): number {
            const length = Number(value)
            return Number.isFinite(length) && length > 0 ? Math.min(length, this.maxLength) : this.maxLength
        },
        /**
         * The common output rate the person entered, held to the slowest selected channel, since an export only ever
         * downsamples. A cleared field keeps the source channel rates.
         * @param value - The rate entered, in hertz; NaN when cleared.
         */
        commitRate (value: unknown): number | null {
            const rate = Number(value)
            if (!Number.isFinite(rate) || rate <= 0) {
                return null
            }
            return this.maxRate === null ? rate : Math.min(rate, this.maxRate)
        },
        /**
         * The start the person entered, held between zero and the last start a permitted length still fits from.
         * Marks the start as set by hand, so it stops following the view, and fits the length to it.
         * @param value - The start entered, in seconds; NaN when cleared.
         */
        commitStart (value: unknown): number {
            const entered = Number(value)
            const start = Number.isFinite(entered) ? Math.min(Math.max(0, entered), this.maxStart) : 0
            this.startSetFor = this.resource?.id ?? null
            this.length = this.fittingLength(start)
            return start
        },
        closeDialog (event?: Event) {
            event?.preventDefault()
            if (!this.busy) {
                this.$emit('close')
            }
        },
        /**
         * Does a range of `length` seconds from `start` fit in the recording.
         * @param start - Range start in seconds.
         * @param length - Range length in seconds.
         */
        fits (start: number, length: number) {
            return start + length <= (this.resource?.totalDuration || 0) + 1e-6
        },
        /**
         * The length to use from `start`: the current one while it still fits, otherwise the first permitted length
         * that does, and with no fixed lengths the rest of the recording. Falls back to the current length when no
         * permitted one fits, so the dialog reports the problem rather than choosing silently.
         * @param start - Range start in seconds.
         */
        fittingLength (start: number) {
            if (!this.durations.length) {
                return this.length > 0 && this.fits(start, this.length)
                       ? this.length
                       : Math.max(0, Math.floor(((this.resource?.totalDuration || 0) - start)*1000)/1000)
            }
            if (this.durations.includes(this.length) && this.fits(start, this.length)) {
                return this.length
            }
            return this.durations.find(duration => this.fits(start, duration)) ?? this.length
        },
        /**
         * Move the start to what the person is looking at, unless they have set it by hand for this recording. Moved
         * back where needed so a permitted length still fits.
         */
        followView () {
            if (this.resource && this.startSetFor === this.resource.id) {
                return
            }
            this.start = Math.min(Math.max(0, this.viewStart), this.maxStart)
            this.length = this.fittingLength(this.start)
        },
        formatNumber (value: number) {
            return Number.isInteger(value) ? String(value) : value.toFixed(2)
        },
        /**
         * Reset the choices from the active recording and the destination's constraints.
         */
        initialise () {
            this.busy = false
            this.toggleOn = this.target?.toggle?.initial ?? true
            if (this.resource && this.startSetFor !== this.resource.id) {
                this.startSetFor = null
            }
            this.resetChoices()
        },
        moveRow (index: number, step: number) {
            const other = index + step
            if (other < 0 || other >= this.rows.length) {
                return
            }
            const rows = [...this.rows]
            ;[rows[index], rows[other]] = [rows[other], rows[index]]
            this.rows = rows
        },
        /**
         * Reset the length, the rate and the channel rows to what the constraints in effect allow, keeping the start
         * where it can stay.
         */
        resetChoices () {
            this.rate = null
            this.length = this.durations.length ? this.durations[0] : 0
            if (this.startSetFor) {
                this.start = Math.min(this.start, this.maxStart)
                this.length = this.fittingLength(this.start)
            } else {
                this.followView()
            }
            if (this.constraints?.channels?.length) {
                this.rows = this.constraints.channels.map(label => ({
                    include: true,
                    label,
                    source: suggestExportSource(label, this.sources) ?? -1,
                }))
            } else {
                this.rows = this.signalSources.map(source => ({
                    include: true,
                    label: source.label,
                    source: source.index,
                }))
            }
        },
        /**
         * Encode the recording under the selection and hand it to the exporter's caller or the target.
         */
        async runExport () {
            if (!this.canExport || !this.exporter?.exportActiveResource) {
                return
            }
            this.busy = true
            try {
                // Taken before encoding, so the file goes where the switch said when it was made.
                const mode = this.mode
                const result = await this.exporter.exportActiveResource(this.exportOptions)
                if (!result) {
                    this.$emit('sent', { message: this.$t('Exporting the recording failed.'), success: false })
                    return
                }
                if (!mode) {
                    this.$emit('exported-file', result)
                    return
                }
                const outcome = await mode.submit({
                    data: result.edf,
                    sidecar: mode.sidecar ? result.sidecar : null,
                })
                this.$emit('sent', outcome)
            } catch (error) {
                this.$emit('sent', { message: this.$t('Sending the recording failed.'), success: false })
            } finally {
                this.busy = false
                this.$emit('close')
            }
        },
        setInclude (index: number, include: boolean) {
            this.rows[index].include = include
        },
        setLabel (index: number, label: string) {
            this.rows[index].label = label.trim() || (this.sources[this.rows[index].source]?.label ?? '')
        },
        /**
         * Set the length from a choice of the permitted durations, which only ever offers one of them.
         * @param value - The chosen duration, in seconds.
         */
        setLength (value: string) {
            const length = Number(value)
            this.length = Number.isFinite(length) && length > 0 ? length : 0
        },
        /**
         * Turn the target's toggle on or off. The constraints change with it, so the choices they fix are reset.
         * @param value - Is the toggle on.
         */
        setToggle (value: boolean) {
            if (value === this.toggleOn) {
                return
            }
            this.toggleOn = value
            this.resetChoices()
        },
        setSource (index: number, value: string) {
            this.rows[index].source = value === '' ? -1 : Number(value)
        },

    },
    beforeMount () {
        // Add component styles to shadow root
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
})
</script>

<style scoped>
/* A full channel template outgrows the viewport; its scroller is sized by the application's dialog rules (App.vue). */
[data-component="signal-export-dialog"] wa-scroller::part(content) {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-bottom: 1rem;
    padding-top: 0.25rem;
}
[data-component="signal-export-dialog"] h3 {
    font-size: 1rem;
    margin: 0.75rem 0 0 0;
}
[data-component="signal-export-dialog"] small {
    display: block;
    font-style: italic;
    margin-top: -0.25rem;
}
[data-component="signal-export-dialog"] p {
    margin: 0;
}
.toggle {
    display: block;
    padding-top: 0;
}
.row {
    display: flex;
    gap: 0.5rem;
}
    .row > * {
        flex: 1 1 0;
    }
.channels {
    border-bottom: solid 1px var(--wa-color-neutral-border-quiet);
    border-collapse: collapse;
    margin-bottom: 0;
    width: 100%;
}
    .channels th {
        font-weight: normal;
        padding: 0 0.5rem 0.5rem 0;
        text-align: start;
    }
    .channels td {
        padding: 0.25rem;
    }
        .channels td > span {
            display: block;
            height: 2.25rem;
            line-height: 2.25rem;
        }
    .channels .order {
        white-space: nowrap;
    }
.warning {
    color: var(--wa-color-warning-on-quiet);
}
    wa-select.warning::part(combobox) {
        background-color: var(--wa-color-danger-fill-quiet);
        border-color: var(--wa-color-danger-on-quiet);
    }
.problem {
    color: var(--wa-color-danger-on-quiet);
}
</style>
