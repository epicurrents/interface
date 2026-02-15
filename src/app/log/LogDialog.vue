<template>
    <wa-dialog ref="dialog"
        class="epicv-dialog"
        :label="$t('Log events')"
        :style="`--width:60rem;`"
        @click.stop=""
    >
        <wa-tab-group>
            <wa-tab panel="browse" slot="nav">{{ $t('Browse')}}</wa-tab>
            <wa-tab-panel name="browse" class="browse">
                <wa-callout open="true">
                    <p>{{ $t(`You can browse events that the application has logged here. Filter by importance or source.`)}}</p>
                </wa-callout>
                <log-inspector
                    :development-mode="!productionMode || undefined"
                    mode="light"
                    :useLog="Log"
                    @wa-after-hide.stop=""
                    @wa-hide.stop=""
                ></log-inspector>
            </wa-tab-panel>
        </wa-tab-group>
    </wa-dialog>
</template>

<script lang="ts">
/**
 * This component holds all the user-definable settings.
 */
import { defineComponent, ref, Ref, reactive } from "vue"
import { T } from "#i18n"
import { useStore } from "vuex"
import { useActiveContext, useContext } from "#config"
import { EpiCStore } from "#store"
import { Log } from "scoped-event-log"
import { LogInspector } from "scoped-event-log/dist/LogInspector"

export default defineComponent({
    name: 'LogDialog',
    components: {
        LogInspector,
    },
    props: {
    },
    setup () {
        const store = useStore() as EpiCStore
        const fadeBottom = ref(true)
        const fadeTop = ref(true)
        const filterImportance = ref([] as number[])
        const filterSource = ref([] as string[])
        const infoOpen = reactive({} as { [name: string]: boolean })
        const logEvents = ref([]) as Ref<ReturnType<typeof Log.getAllEvents>>
        const logSources = ref([] as string[])
        // Allow more log features in development mode.
        const productionMode = window.__EPICURRENTS__.SETUP.isProduction === true
        // DOM
        const dialog = ref<HTMLDivElement>() as Ref<any>
        const wrapper = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            fadeBottom,
            fadeTop,
            filterImportance,
            filterSource,
            infoOpen,
            logEvents,
            logSources,
            productionMode,
            //DOM
            dialog,
            wrapper,
            // Scope
            useContext,
            ...useActiveContext(store),
            Log,
        }
    },
    watch: {
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
        closeDialog (event: Event) {
            event.preventDefault()
            this.$emit('close')
        },
        overlayClicked () {
            this.$emit('close')
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
        this.dialog.addEventListener('sl-request-close', this.closeDialog)
    },
    beforeUnmount () {
        this.dialog.removeEventListener('sl-request-close', this.closeDialog)
    },
})
</script>

<style scoped>
log-inspector {
    flex: 1;
    max-height: 100%;
    overflow: hidden;
}
    log-inspector::part(component) {
        height: calc(100vh - var(--wa-space-2xl) - 77px - 8rem);
        display: flex;
        flex-direction: column;
    }
wa-callout {
    margin-bottom: 1rem;
}
wa-dialog {
    /* Make dialog height constant to avoid jumps when filtering or switching pages. */
    height: calc(100vh - var(--wa-space-2xl));
    overflow: hidden;
}
    wa-dialog::part(dialog) {
        height: calc(100% - var(--wa-space-2xl));
    }
.title {
    height: 40px;
    padding: 0 20px;
    line-height: 40px;
    font-variant: small-caps;
    background-color: var(--epicv-background-emphasize);
}
.tabs {
    position: relative;
    top: 1px;
    display: flex;
    height: 32px;
    padding: 0 10px;
    margin-top: 9px;
    line-height: 32px;
}
    .tab {
        flex-grow: 0;
        padding: 0 10px;
        border-top: 1px solid var(--epicv-border-faint);
        border-left: 1px solid var(--epicv-border-faint);
        border-top-left-radius: 5px;
        border-top-right-radius: 5px;
        border-right: none;
        border-bottom: none;
        cursor: pointer;
        background-color: var(--epicv-background);
    }
    .tab.inactive {
        border-bottom-color: var(--epicv-border-faint);
        color: var(--epicv-text-faint);
        background-color: transparent;
    }
    .tab.endtab {
        border-right: 1px solid var(--epicv-border-faint);
    }
wa-tab-panel {
    height: calc(100% - 2rem);
    overflow: hidden;
}
.tabdesc {
    padding: 10px 10px 0 10px;
}
</style>
