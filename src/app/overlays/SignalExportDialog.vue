<template>
    <wa-dialog ref="dialog"
        class="epicv-dialog"
        data-component="signal-export-dialog"
        :label="title"
        :open="open"
        :style="`--width:48rem;`"
        @click.stop=""
        @wa-close="closeDialog"
    >
        <p v-if="!resource" class="epicv-text-faint">{{ $t('There is no recording to export.') }}</p>
        <template v-else>
            <!-- Range -->
            <h3>{{ $t('Range') }}</h3>
            <div class="row">
                <wa-input
                    :label="$t('Start (s)')"
                    min="0"
                    size="s"
                    type="number"
                    :value="String(start)"
                    @change="setStart($event.target.value)"
                ></wa-input>
                <wa-select v-if="durations.length"
                    :label="$t('Length (s)')"
                    size="s"
                    :value="String(length)"
                    @change="setLength($event.target.value)"
                    @wa-after-hide.stop=""
                    @wa-hide.stop=""
                >
                    <wa-option v-for="duration in durations"
                        :key="`duration-${duration}`"
                        :value="String(duration)"
                    >{{ duration }}</wa-option>
                </wa-select>
                <wa-input v-else
                    :label="$t('Length (s)')"
                    min="0"
                    size="s"
                    type="number"
                    :value="String(length)"
                    @change="setLength($event.target.value)"
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
            <!-- Sampling rate -->
            <h3>{{ $t('Sampling rate') }}</h3>
            <p v-if="constraints?.samplingRate !== undefined">
                {{ $t('{rate} Hz, as the destination requires.', { rate: constraints.samplingRate }) }}
            </p>
            <div v-else class="row">
                <wa-input
                    :label="$t('Output rate (Hz)')"
                    min="1"
                    :placeholder="$t('Source rates')"
                    size="s"
                    type="number"
                    :value="rate === null ? '' : String(rate)"
                    @change="setRate($event.target.value)"
                ></wa-input>
            </div>
            <p v-if="constraints?.amplitudeRange">
                {{ $t('Samples are clipped to {min} … {max} {unit}.', {
                    min: constraints.amplitudeRange[0],
                    max: constraints.amplitudeRange[1],
                    unit: constraints.unit || '',
                }) }}
            </p>
            <!-- Summary -->
            <wa-divider></wa-divider>
            <p>{{ summary }}</p>
            <p v-if="deidentified" class="epicv-text-faint">
                {{ $t('The file is de-identified: subject identifiers are blanked and annotation text is removed.') }}
            </p>
            <p v-if="sidecarIdentified" class="warning">
                {{ $t('The metadata sent with the file is not de-identified and carries the original subject details.') }}
            </p>
            <ul v-if="problems.length" class="problems">
                <li v-for="(problem, index) in problems" :key="`problem-${index}`">{{ problem }}</li>
            </ul>
        </template>
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
import { defineComponent, PropType } from "vue"
import { T } from "#i18n"
import { checkExportSelection, suggestExportSource } from "@epicurrents/core/util"
import type {
    BiosignalResource,
    EpicurrentsApp,
    SignalExportConstraints,
    SignalExportSelection,
    SignalExportSourceChannel,
    SignalExportTarget,
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
    data () {
        return {
            busy: false,
            length: 0,
            rate: null as number | null,
            rows: [] as ChannelRow[],
            start: 0,
        }
    },
    computed: {
        app (): EpicurrentsApp | null {
            return window.__EPICURRENTS__.APP as EpicurrentsApp | null
        },
        canExport (): boolean {
            return !this.busy && !!this.resource && !!this.exporter?.exportActiveResource && !this.problems.length
        },
        constraints (): SignalExportConstraints | undefined {
            return this.target?.constraints
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
         * otherwise; the selection is always the dialog's.
         */
        exportOptions (): Record<string, unknown> {
            const defaults = this.target ? { deidentify: true, deidentifySidecar: true } : { deidentify: true }
            return { ...defaults, ...(this.target?.options || {}), selection: this.selection }
        },
        fixedChannels (): boolean {
            return !!this.constraints?.channels?.length
        },
        interruptions (): [number, number][] {
            return (this.resource?.interruptions || []).map(
                ({ start, duration }): [number, number] => [start, duration]
            )
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
            return !!this.target?.sidecar && this.exportOptions.deidentifySidecar === false
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
    },
    watch: {
        open (value: boolean) {
            if (value) {
                this.initialise()
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
        closeDialog (event?: Event) {
            event?.preventDefault()
            if (!this.busy) {
                this.$emit('close')
            }
        },
        formatNumber (value: number) {
            return Number.isInteger(value) ? String(value) : value.toFixed(2)
        },
        /**
         * Reset the choices from the active recording and the destination's constraints.
         */
        initialise () {
            this.busy = false
            this.start = 0
            this.rate = null
            this.length = this.durations.length ? this.durations[0] : (this.resource?.totalDuration || 0)
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
         * Encode the recording under the selection and hand it to the exporter's caller or the target.
         */
        async runExport () {
            if (!this.canExport || !this.exporter?.exportActiveResource) {
                return
            }
            this.busy = true
            try {
                const result = await this.exporter.exportActiveResource(this.exportOptions)
                if (!result) {
                    this.$emit('sent', { message: this.$t('Exporting the recording failed.'), success: false })
                    return
                }
                if (!this.target) {
                    this.$emit('exported-file', result)
                    return
                }
                const outcome = await this.target.submit({
                    data: result.edf,
                    sidecar: this.target.sidecar ? result.sidecar : null,
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
        setLength (value: string) {
            const length = Number(value)
            this.length = Number.isFinite(length) && length > 0 ? length : 0
        },
        setRate (value: string) {
            const rate = Number(value)
            this.rate = value.trim() && Number.isFinite(rate) ? rate : null
        },
        setSource (index: number, value: string) {
            this.rows[index].source = value === '' ? -1 : Number(value)
        },
        setStart (value: string) {
            const start = Number(value)
            this.start = Number.isFinite(start) && start > 0 ? start : 0
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
[data-component="signal-export-dialog"]::part(body) {
    padding-bottom: 1rem;
    padding-top: 0.25rem;
}
[data-component="signal-export-dialog"] h3 {
    font-size: 1rem;
    margin: 1rem 0 0.5rem;
}
.row {
    display: flex;
    gap: 0.5rem;
}
    .row > * {
        flex: 1 1 0;
    }
.channels {
    border-collapse: collapse;
    width: 100%;
}
    .channels th {
        font-weight: normal;
        text-align: start;
    }
    .channels td {
        padding: 0.125rem 0.25rem;
    }
    .channels .order {
        white-space: nowrap;
    }
.warning {
    color: var(--wa-color-warning-on-quiet);
}
.problems {
    color: var(--wa-color-danger-on-quiet);
    margin: 0.5rem 0 0;
    padding-inline-start: 1.25rem;
}
</style>
