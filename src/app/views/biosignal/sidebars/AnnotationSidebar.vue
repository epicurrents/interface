<template>
    <div data-component="annotation-sidebar"
        :style="{
            display: open ? 'block' : 'none'
        }"
    >
        <div class="title">{{ $t('Annotations') }}</div>
        <div class="export">
            <wa-switch
                :checked="SETTINGS.annotations.saveToDataset"
                @change="saveAnnotationsChanged($event.target.checked)"
            >
                {{ $t('Save annotations to dataset') }}
            </wa-switch>
        </div>
        <wa-tab-group ref="tabs"
            @keydown="stopPropagation"
            @keyup="stopPropagation"
        >
            <wa-tab v-if="availableTabs.includes('events')" panel="events">
                {{ $t('Events') }}
            </wa-tab>
            <wa-tab v-if="availableTabs.includes('create')" panel="create">
                {{ $t('Create') }}
            </wa-tab>
            <wa-tab-panel v-if="availableTabs.includes('events')" name="events">
                <div class="header">
                    <div class="time">{{ $t('Time') }}</div>
                    <div class="label">{{ $t('Description') }}</div>
                    <div class="action" @click="undoRemove">
                        <app-icon v-if="areDeletedEvents"
                            name="undo"
                            :title="$t('Undo remove annotation')"
                        ></app-icon>
                    </div>
                </div>
                <div class="events-content">
                    <wa-scroller orientation="vertical">
                        <div v-if="!RESOURCE.events.length" class="placeholder">
                            {{ $t('No events') }}
                        </div>
                        <div v-for="(event, idy) of RESOURCE.events" :key="`eeg-event-${idy}`"
                            class="row"
                            @click="goToEvent(event.start)"
                        >
                            <div :class="[
                                    'epicv-oneliner',
                                    'time',
                                ]"
                                :title="timePartsToShortString(secondsToTimeString(event.start, true) as number[])"
                            >
                                <span v-if="timeLabel(event.start).days">{{ timeLabel(event.start).days }}</span>
                                <span v-if="timeLabel(event.start).days" class="day">d</span>
                                <span class="main">{{ timeLabel(event.start).main }}</span>
                                <span v-if="timeLabel(event.start).secs" class="secs">:{{ timeLabel(event.start).secs }}</span>
                            </div>
                            <div :class="[
                                    'epicv-oneliner',
                                    'label',
                                ]"
                                :title="event.label"
                            >{{ event.label }}</div>
                            <div class="action" @click="removeEvent($event, event.id)">
                                <app-icon name="trash" :title="$t('Remove event')"></app-icon>
                            </div>
                        </div>
                    </wa-scroller>
                </div>
                <div class="submit">
                    <wa-select
                        :placeholder="$t('Export format')"
                        size="small"
                        :title="$t('Export format')"
                        :value="exportFormat"
                        @input="exportFormatChanged($event.target.value)"
                        @wa-hide="stopPropagation"
                        @wa-show="stopPropagation"
                    >
                        <wa-option value="epicurrents">
                            {{ $t("EpiCurrents") }}
                        </wa-option>
                        <wa-option value="mne">
                            {{ $t("MNE") }}
                        </wa-option>
                    </wa-select>
                    <wa-button
                        appearance="filled-outlined"
                        :disabled="!RESOURCE.events.length"
                        size="small"
                        variant="brand"
                        @click="downloadAnnotations"
                    >
                        {{ $t('Export') }}
                    </wa-button>
                </div>
            </wa-tab-panel>
            <wa-tab-panel v-if="availableTabs.includes('create')" name="create">
                <wa-textarea ref="newText"
                    class="create-text"
                    resize="auto"
                    rows="2"
                    size="small"
                ></wa-textarea>
                <div class="submit">
                    <wa-select
                        :placeholder="$t('Annotation')"
                        size="small"
                        :value="newClass.toString()"
                        @input="changeClass"
                        @wa-hide="stopPropagation"
                        @wa-show="stopPropagation"
                    >
                        <wa-option v-for="(option, idx) in Object.values(SETTINGS.annotations.classes)" :key="`${ID}-option-${idx}`"
                            :value="option.quickCode"
                        >
                            {{ $t(option.label) }}
                        </wa-option>
                    </wa-select>
                    <wa-button
                        appearance="filled-outlined"
                        size="small"
                        variant="brand"
                        @click="createEvents"
                    >
                        {{ $t('Create') }}
                    </wa-button>
                </div>
            </wa-tab-panel>
        </wa-tab-group>
    </div>
</template>


<script lang="ts">
/**
 * Side drawer for biosignal annotations.
 */
import {
    defineComponent,
    PropType,
    ref,
    type Ref,
} from "vue"
import { T } from "#i18n"
import { useStore } from "vuex"
import { useBiosignalContext } from "#config"
// Reimport these to use as types.
import type { default as WaTabGroup } from "@awesome.me/webawesome/dist/components/tab-group/tab-group.js"
import type { default as WaTextarea } from "@awesome.me/webawesome/dist/components/textarea/textarea.js"
import {
    padTime,
    secondsToTimeString,
    settingsColorToRgba,
    timePartsToShortString,
} from "@epicurrents/core/util"
import { PlotSelection } from '#app/views/biosignal/types'
import { Log } from "scoped-event-log"

type AnnotationExportFormat = 'epicurrents' | 'mne'

export default defineComponent({
    name: 'BiosignalAnnotationSidebar',
    props: {
        areDeletedEvents: {
            type: Boolean,
            default: false,
        },
        availableTabs: {
            type: Array as PropType<string[]>,
            default: ['labels', 'events', 'create'],
        },
        open: {
            type: Boolean,
            default: false,
        },
        selections: {
            type: Object as PropType<PlotSelection[]>,
            default: [],
        },
        tab: {
            type: String,
            default: '',
        },
        viewStep: {
            type: Number,
            default: 1,
        },
        visibleRange: {
            type: Number,
            default: 0,
        },
        width: {
            type: Number,
            default: 300,
        },
    },
    setup (/*props, { attrs, slots, emit }*/) {
        // DOM
        const context = useBiosignalContext(useStore())
        // Don't spam the error message if annotations cannot be saved, just show it once.
        const cannotWriteMessageDisplayed = ref(false)
        const comments = context.RESOURCE.labels.filter(l => l.name === 'comments')
                                                .map(l => l.value as string).flat() as string[]
        const drawer = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const exportFormat = ref('epicurrents' as AnnotationExportFormat)
        const isOverADay = typeof context.RESOURCE.getAbsoluteTimeAt !== 'undefined'
            ? context.RESOURCE.getAbsoluteTimeAt(0).day !== context.RESOURCE.getAbsoluteTimeAt(
                    context.RESOURCE.totalDuration
                ).day
            : false
        const isOverAnHour = typeof context.RESOURCE.getAbsoluteTimeAt !== 'undefined'
            ? context.RESOURCE.totalDuration >= 60*60 ||
              context.RESOURCE.getAbsoluteTimeAt(0).hour !== context.RESOURCE.getAbsoluteTimeAt(
                  context.RESOURCE.totalDuration
              ).hour
            : false
        const tabs = ref<WaTabGroup>() as Ref<WaTabGroup>
        const newText = ref<WaTextarea>() as Ref<WaTextarea>
        const newClass = ref(context.SETTINGS.annotations.classes?.default.quickCode ?? -1)
        const unsubscribe = ref<(() => void) | null>(null)
        return {
            cannotWriteMessageDisplayed,
            comments,
            drawer,
            exportFormat,
            isOverADay,
            isOverAnHour,
            // DOM refs
            tabs,
            newText,
            newClass,
            // Methods
            secondsToTimeString,
            timePartsToShortString,
            unsubscribe,
            ...context,
        }
    },
    computed: {
        bottomBorder (): string {
            if (!this.SETTINGS.border?.bottom) {
                return 'none'
            }
            const borderStyle = this.SETTINGS.border.bottom.style
            const borderWidth = this.SETTINGS.border.bottom.width
            const borderColor = settingsColorToRgba(this.SETTINGS.border.bottom.color)
            return `${borderStyle} ${borderWidth}px ${borderColor}`
        },
        timeWidth (): string {
            if (!this.isOverADay && !this.isOverAnHour) {
                // If the recording is less than an hour, we only need to show minutes and seconds.
                return '4rem'
            } else if (!this.isOverADay) {
                // If the recording is less than 24 hours, HH:MM:SS is enough.
                return '5.25rem'
            }
            // If the recording is longer than 24 hours, we need to show days as well.
            return '6.25rem'
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
        annotationsUpdated () {
            if (this.SETTINGS.annotations.saveToDataset) {
                const dataset = this.$store.state.APP.activeDataset
                if (dataset?.hasOutputSource) {
                    dataset.writeToOutputDataSource(
                        this.RESOURCE.name + '_annotations.json',
                        this.exportAnnotations()
                    ).then(result => {
                        if (!result.success && !this.cannotWriteMessageDisplayed) {
                            Log.error('Failed to write annotations to dataset.', this.$options.name!)
                            this.$store.dispatch('display-callout', {
                                role: 'error',
                                message: [
                                    this.$t(`Could not save annotations.`),
                                    this.$t(
                                        result.message
                                        ? `See more information below.`
                                        : `Make sure you have write permission to the destination folder.`
                                    )
                                ].join(' ')
                            })
                            if (result.message) {
                                this.$store.dispatch('display-callout', {
                                    role: 'error',
                                    message: result.message
                                })
                            }
                            this.cannotWriteMessageDisplayed = true
                        }
                    })
                }
            }
        },
        checkTab () {
            if (this.selections.length) {
                // Assume user wants to create annotations if there are selections.
                this.tabs.active = 'create'
            } else if (this.tab) {
                this.tabs.active = this.tab
            } else {
                this.tabs.active = this.availableTabs[0]
            }
        },
        changeClass (value: string) {
            const newClass = parseInt(value)
            if (this.newClass !== newClass) {
                this.newClass = newClass
            }
        },
        close () {
            this.$emit('close')
        },
        createEvents () {
            const props = {
                code: this.newClass || 0,
                skipEditor: true,
                text: this.newText.value || '',
            }
            this.$emit('create-events', props)
        },
        downloadAnnotations () {
            // Download the annotations as a file.
            // From https://stackoverflow.com/a/18197341.
            if (!this.RESOURCE.events.length && !this.RESOURCE.labels.length) {
                return
            }
            const dlEl = document.createElement('a')
            dlEl.setAttribute(
                'href',
                'data:text/plain;charset=utf-8,' + encodeURIComponent(this.exportAnnotations())
            )
            dlEl.setAttribute('download', 'annotations.json')
            dlEl.style.display = 'none'
            document.body.appendChild(dlEl)
            dlEl.click()
            document.body.removeChild(dlEl)
        },
        exportAnnotations () {
            if (!this.RESOURCE.events.length && !this.RESOURCE.labels.length) {
                return ''
            }
            // Include recording start time as timestamp. This allows using the exported annotations in partial
            // files of the same recording, as long as the start time of the part is known.
            const recStartTime = this.RESOURCE.startTime?.getTime() || 0
            // Construct an array of annotations to export in the requested format.
            const events = this.RESOURCE.events.map(a => a.serialize())
            if (this.exportFormat === 'mne') {
                // Export a JSON file that follows the MNE Annotations object structure.
                // https://mne.tools/stable/generated/mne.Annotations.html#mne.Annotations
                return JSON.stringify({
                    ch_names: events.map(a => a.channels),
                    description: events.map(a => a.label),
                    duration: events.map(a => a.duration),
                    format: 'mne',
                    onset: events.map(a => a.start),
                    // POSIX timestamp, optionally could be converted into datetime '%Y-%m-%d %H:%M:%S.%f'.
                    orig_time: recStartTime/1000,
                })
            }
            // Export the annotations and some context information.
            const labels = this.RESOURCE.labels.map(l => l.serialize())
            return JSON.stringify({
                events: events,
                labels: labels,
                format: 'epicurrents',
                montage: this.RESOURCE.activeMontage?.name || null,
                startTime: recStartTime,
            })
        },
        exportFormatChanged (value: AnnotationExportFormat) {
            this.exportFormat = value
            this.annotationsUpdated()
        },
        goToEvent (time: number) {
            // Center the view on the selected annotation.
            const annoRange = this.viewStep < this.visibleRange ? time - this.visibleRange/2 : time
            const viewStart = Math.max(0, annoRange - annoRange%this.viewStep)
            this.RESOURCE.viewStart = viewStart
        },
        removeEvent (event: MouseEvent, id: string) {
            // Prevent click from activating navigation (row click action) to removed event.
            event.stopPropagation()
            this.$emit('remove-event', id)
        },
        saveAnnotationsChanged (value: boolean) {
            // Reset the error message display if the option is toggled.
            this.cannotWriteMessageDisplayed = false
            this.$store.dispatch(
                'set-settings-value',
                { field: `${this.RESOURCE.modality}.annotations.saveToDataset`, value }
            )
        },
        stopPropagation (event: CustomEvent) {
            // Must stop event propagation from affecting parent components.
            event.stopPropagation()
        },
        timeLabel (time: number) {
            const timeParts = this.RESOURCE.getAbsoluteTimeAt(time)
            if (!this.isOverADay) {
                // Less than a day.
                if (!this.isOverAnHour) {
                    // Less than an hour.
                    return {
                        main: `${padTime(timeParts.minute)}:${padTime(timeParts.second)}`
                    }
                }
                return {
                    main: `${padTime(timeParts.hour)}:${padTime(timeParts.minute)}`,
                    secs: padTime(timeParts.second),
                }
            } else {
                // More than a day.
                return {
                    days: timeParts.day.toString(),
                    main: `${padTime(timeParts.hour)}:${padTime(timeParts.minute)}`,
                    secs: padTime(timeParts.second),
                }
            }
        },
        undoRemove () {
            this.$emit('undo-remove')
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
        this.RESOURCE.onPropertyChange(['events', 'labels'], this.annotationsUpdated, this.ID)
        this.unsubscribe = this.$store.subscribe((mutation) => {
            // Reload plot if certain user settings change.
            const updateOnFields = [
                `${this.RESOURCE.modality}.annotations.saveToDataset`
            ]
            if (mutation.type === 'set-settings-value') {
                if (updateOnFields.includes(mutation.payload.field)) {
                    this.annotationsUpdated()
                }
            }
        })
        requestAnimationFrame(() => {
            if (this.drawer) {
                this.drawer.style.width = `${this.width}px`
            }
            this.checkTab()
        })
    },
    beforeUnmount () {
        this.RESOURCE.removeAllEventListeners(this.ID)
        this.unsubscribe?.()
    },
})
</script>

<style scoped>
[data-component="annotation-sidebar"] {
    background-color: var(--epicv-background);
    border-bottom: v-bind(bottomBorder);
    border-left: 1px solid var(--epicv-border-faint);
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    padding: 0.5rem;
    position: relative;
}
[data-component="annotation-sidebar"] wa-tab::part(base) {
    height: 0;
    padding: 1rem 1rem 1rem 0.125rem;
}
[data-component="annotation-sidebar"] wa-tab-group {
    height: calc(100% - 2.25rem);
    overflow: hidden;
}
    [data-component="annotation-sidebar"] wa-tab-group::part(base) {
        height: 100%;
        overflow: hidden;
        padding: 0.75rem 0 0 0;
    }
    [data-component="annotation-sidebar"] wa-tab-group::part(nav) {
        padding: 0 0.25rem;
    }
    [data-component="annotation-sidebar"] wa-tab-group::part(body) {
        flex: calc(100% - 32px) 0 0;
        overflow: hidden;
    }
[data-component="annotation-sidebar"] wa-divider {
    margin: 0.5rem 0;
}
[data-component="annotation-sidebar"] wa-scroller::part(content) {
    padding: 0 0.25rem 0.25rem 0.25rem;
}
[data-component="annotation-sidebar"] wa-tab-panel {
    height: calc(100% - 34px);
    overflow: hidden;
}
[data-component="annotation-sidebar"] wa-tab-panel::part(base) {
    height: 100%;
    overflow: hidden;
    padding: 0.5rem 0 0 0;
}
.title {
    font-size: 1.25rem;
    height: 2rem;
    line-height: 2rem;
    padding: 0 0.25rem;
}
.labels-wrapper wa-input,
.labels-wrapper wa-select,
.labels-wrapper wa-textarea {
    margin-top: 0.25rem;
}
.header {
    display: flex;
    flex-wrap: nowrap;
    height: 1.5rem;
    line-height: 1.5rem;
    font-variant: small-caps;
    font-size: 0.875rem;
    padding: 0 0.25rem;
}
    .header wa-icon {
        cursor: pointer;
    }
.events-content {
    border-top: 1px solid var(--epicv-border-active);
    border-bottom: 1px solid var(--epicv-border-active);
    margin: 0 0.25rem;
}
    .events-content wa-scroller::part(content) {
        padding: 0.25rem 0;
    }
    .placeholder {
        height: 1.5rem;
        line-height: 1.5rem;
        color: var(--epicv-text-faint);
        padding-left: 0.25rem;
    }
    .row {
        display: flex;
        flex-wrap: nowrap;
        height: 1.5rem;
        line-height: 1.5rem;
        border-radius: 0.25rem;
        cursor: pointer;
    }
        .row:hover {
            background-color: var(--epicv-background-hover);
        }
        .time {
            flex-basis: v-bind(timeWidth);
            padding-left: 0.25rem;
        }
            .time > span:not(.main) {
                margin-inline-end: 0.1rem;
            }
            .time .day {
                color: var(--epicv-text-faint);
            }
            .time .secs {
                color: var(--epicv-text-faint);
                font-size: 0.8rem;
            }
        .label {
            flex-grow: 1;
        }
        .action {
            flex: 1.5rem 0 0;
            padding: 0 0.25rem;
            text-align: center;
        }
        .row .action {
            color: darkred;
            opacity: 0;
            transition: opacity ease 0.1s;
        }
            .row:hover .action {
                opacity: 1;
            }
.submit {
    display: flex;
    gap: 0.25rem;
    padding: 0.5rem 0.25rem;
}
.create-text {
    margin: 0 0.25rem;
}
</style>
