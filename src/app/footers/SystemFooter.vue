<template>
    <app-footer data-component="system-footer"
        border-right
        border-top
    >
        <wa-popup
            :active="popupOpen"
            arrow
            arrow-placement="anchor"
            class="popup"
            distance="8"
            placement="top-start"
            skidding="2"
        >
            <wa-button
                appearance="epicv"
                slot="anchor"
                variant="brand"
                @click="togglePopup"
            >
                <app-icon name="microchip" variant="light"></app-icon>
            </wa-button>
            <div class="content">
                <div class="header">
                    {{ $t('Log events') }}
                    <wa-button
                        appearance="epicv"
                        size="small"
                        :title="$t('Close')"
                        @click="togglePopup($event, false)"
                    >
                        <app-icon name="xmark"></app-icon>
                    </wa-button>
                </div>
                <div v-if="errorCount || warningCount" class="logs">
                    <span v-if="errorCount" class="error">
                        <app-icon class="inline" name="octagon-exclamation"></app-icon>
                        {{ $t('{n} errors', { n: errorCount }) }}
                    </span>
                    <span v-if="errorCount && warningCount" class="separator">|</span>
                    <span v-if="warningCount" class="warning">
                        <app-icon class="inline" name="triangle-exclamation"></app-icon>
                        {{ $t('{n} warnings', { n: warningCount }) }}
                    </span>
                </div>
                <wa-button
                    appearance="plain"
                    size="small"
                    variant="brand"
                    @click="$store.dispatch('toggle-dialog', { name: 'log' })"
                >
                    <app-icon class="inline" slot="start" name="search"></app-icon>
                    {{ $t('Browse') }}
                </wa-button>
                &nbsp; &nbsp; &nbsp;
                <wa-button
                    appearance="plain"
                    download="logs.json"
                    size="small"
                    variant="brand"
                    @click.capture="downloadLogs"
                >
                    <app-icon class="inline" slot="start" name="floppy-disk"></app-icon>
                    {{ $t('Download') }}
                </wa-button>
                <wa-divider></wa-divider>
                <div class="header">{{ $t('System stats') }}</div>
                <wa-progress-bar
                    class="bar"
                    :style="[
                        '--track-height: 0.5rem',
                        usedMemoryFraction >= 0.75
                        ? '--indicator-color: red'
                        : usedMemoryFraction >= 0.5
                        ? '--indicator-color: orange'
                        : ''
                    ]"
                    :value="usedMemoryFraction*100"
                ></wa-progress-bar>
                <div>{{ usedMemoryMessage }}</div>
            </div>
        </wa-popup>
        <wa-button v-if="errorCount"
            appearance="epicv"
            class="error"
            :tooltip="$t('There are errors in the log.')"
            variant="danger"
            @click="togglePopup"
        >
            <app-icon name="octagon-exclamation" variant="solid"></app-icon>
        </wa-button>
        <wa-button v-else-if="warningCount"
            appearance="epicv"
            class="warning"
            :tooltip="$t('There are warnings in the log.')"
            variant="warning"
            @click="togglePopup"
        >
            <app-icon name="triangle-exclamation" variant="solid"></app-icon>
        </wa-button>
        <div :class="{
                'info': true,
                'visible': isDatasetLoading,
            }"
        >
            <wa-tooltip
                :content="$t('Loading studies from {c}...', { c: datasetContext })"
                placement="top"
            >
                <app-icon
                    :class="{
                        'inline': true,
                        'blink': datasetLoaded < datasetTotal,
                    }"
                    :name="datasetIconName"
                ></app-icon>
                {{ datasetLoaded < datasetTotal ? `${datasetLoaded}/${datasetTotal}` : $t('Done') }}
            </wa-tooltip>
        </div>
    </app-footer>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import AppFooter from "./AppFooter.vue"
import { T } from "#i18n"
import { Log, type LogLevel } from 'scoped-event-log'

export default defineComponent({
    name: 'DefaultFooter',
    components: {
        AppFooter, // This is loaded synchronously
    },
    setup () {
        const datasetContext = ref('unknown')
        const datasetLoaded = ref(0)
        const datasetTotal = ref(0)
        const errorCount = ref(0)
        const isDatasetLoading = ref(false)
        const lastHeapWarning = ref(0)
        const popupOpen = ref(false)
        const updateIntv =  ref(0)
        const usedHeap = ref(0)
        const totalHeap = ref(0)
        const totalMem = ref(1)
        const warningCount = ref(0)
        // Unsubscriber.
        const unsubscribe = null as (() => void) | null
        return {
            datasetContext,
            datasetLoaded,
            datasetTotal,
            errorCount,
            isDatasetLoading,
            lastHeapWarning,
            popupOpen,
            updateIntv,
            usedHeap,
            totalHeap,
            totalMem,
            warningCount,
            // Unsubscribers.
            unsubscribe,
        }
    },
    computed: {
        datasetIconName (): string {
            if (!this.datasetTotal || this.datasetLoaded < this.datasetTotal) {
                switch (this.datasetContext) {
                    case 'filesystem':
                        { return 'folder-arrow-down' }
                    case 'repository':
                        { return 'cloud-arrow-down' }
                    default:
                        { return 'circle-question' }
                }
            }
            return 'circle-check'
        },
        usedMemoryFraction (): number {
            return this.totalHeap/this.totalMem
        },
        usedMemoryMessage (): string {
            if (!this.usedHeap) {
                return this.$t(`Memory use: initializing...`)
            }
            const percent = this.usedMemoryFraction*100
            const used = this.totalHeap/1_000_000
            const total = this.totalMem/1_000_000
            return this.$t(
                `Memory use: {p} % ({u} / {t} MiB)`,
                {
                    p: percent.toFixed(1),
                    u: used.toFixed(),
                    t: total.toFixed(),
                }
            )
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
        closeOnEsc (event: KeyboardEvent) {
            if (event.key === 'Escape' || event.key === 'Esc') {
                this.popupOpen = false
            }
        },
        downloadLogs () {
            // Download the logs as a JSON file.
            // From https://stackoverflow.com/a/18197341.
            const logs = Log.exportToJson()
            const dlEl = document.createElement('a')
            dlEl.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(logs))
            dlEl.setAttribute('download', 'logs.json')
            dlEl.style.display = 'none'
            document.body.appendChild(dlEl)
            dlEl.click()
            document.body.removeChild(dlEl)
        },
        togglePopup (_event: PointerEvent, value?: boolean) {
            value ??= !this.popupOpen
            this.popupOpen = value
        },
        updateLogMessages (level?: LogLevel) {
            if (level === 'WARN') {
                this.warningCount = Log.getAllEventsAtLevel('WARN').length
            } else if (level === 'ERROR') {
                this.errorCount = Log.getAllEventsAtLevel('ERROR').length
            }
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
        document.addEventListener('keydown', this.closeOnEsc)
        Log.addEventListener(['WARN', 'ERROR'], this.updateLogMessages, 'SystemFooter')
        let showLoadingTimeout = 0
        this.unsubscribe = this.$store.subscribeAction(action => {
            if (action.type === 'load-dataset-progress') {
                this.isDatasetLoading = true
                if (showLoadingTimeout) {
                    window.clearTimeout(showLoadingTimeout)
                }
                this.datasetContext = action.payload.context
                this.datasetLoaded = action.payload.loaded
                this.datasetTotal = action.payload.total
                showLoadingTimeout = window.setTimeout(() => {
                    this.isDatasetLoading = false
                }, 4500)
            }
        })
        this.updateIntv = window.setInterval(() => {
            if (typeof (performance as any).memory !== 'undefined') {
                this.usedHeap = (performance as any).memory.usedJSHeapSize
                this.totalHeap = (performance as any).memory.totalJSHeapSize
                this.totalMem = (performance as any).memory.jsHeapSizeLimit
                const heapPercent = (this.totalHeap/this.totalMem)*100
                // Only give possible warning every 10 % to avoid flooding the log.
                const heapPerdec = Math.floor(heapPercent/10)
                if (heapPercent >= 50 && this.lastHeapWarning < heapPerdec) {
                    Log.warn(`JavaScript heap size is ${heapPercent.toFixed(1)} % of total available memory.`, 'SystemFooter')
                    this.lastHeapWarning = heapPerdec
                }
            }
        }, 5000)
    },
    beforeUnmount () {
        window.clearInterval(this.updateIntv)
        Log.removeAllEventListeners('SystemFooter')
        document.removeEventListener('keydown', this.closeOnEsc)
    },
})
</script>

<style scoped>
.error wa-icon {
    color: var(--epicv-error);
}
.warning wa-icon {
    color: var(--epicv-warning);
}
[data-component="system-footer"] wa-button:not([appearance="plain"])::part(base) {
    width: 1.5rem;
    height: 1.5rem;
    min-height: 1.5rem;
    line-height: 1.5rem;
    box-shadow: none;
    outline: none;
    border: none;
    border-radius: 0;
    padding: 0;
}
    [data-component="system-footer"] wa-button:not([appearance="plain"])::part(base):focus  {
        outline: none;
        box-shadow: var(--epicv-button-focused);
    }
.popup::part(arrow) {
    background-color: var(--epicv-border);
    z-index: -1;
}
.popup::part(popup) {
    z-index: 5;
}
.popup .content {
    padding: 0.25rem 0.75rem 0.75rem 0.75rem;
    width: calc(15rem + 1px);
    border: 1px solid var(--epicv-border);
    border-radius: 0.5rem;
    background-color: var(--epicv-background);
    font-size: 0.8rem;
    white-space: nowrap;
}
.popup .header {
    display: flex;
    justify-content: space-between;
    height: 2rem;
    line-height: 2rem;
    font-weight: bold;
}
    .content wa-divider {
        margin: 0.75em 0;
    }
    .logs {
        line-height: 1.5em;
    }
    .logs app-icon {
        cursor: default;
    }
    .logs .separator {
        display: inline-block;
        margin: 0 0.5em;
    }
.popup app-icon {
    cursor: pointer;
}
.popup wa-button[appearance="plain"]::part(base) {
    height: 1.75em;
    left: -0.25rem;
    line-height: 1.75em;
    padding-inline-end: 0.5rem;
    padding-inline-start: 0.25rem;
    position: relative;
}
.popup wa-button[appearance="plain"]::part(label) {
    padding-right: 0;
}
.bar::part(base) {
    margin: 0.25rem 0;
}
.info {
    color: var(--epicv-text);
    font-size: 0.8rem;
    line-height: 1.5rem;
    margin-left: auto;
    padding-right: 0.5em;
    opacity: 0;
    transition: opacity 0.5s ease-in-out;
}
    .info.visible {
        opacity: 1;
    }
    .info app-icon {
        color: var(--epicv-icon-active);
        margin-right: 0.25em;
    }
    .blink {
        animation: blinker 1s linear infinite;
    }

@keyframes blinker {
    50% {
        opacity: 0.5;
    }
}
</style>
