<template>
    <wa-dialog ref="dialog"
        class="epicv-dialog"
        :label="$t('Instructions')"
        :style="`--width:90vw;`"
        @click.stop=""
    >
        <wa-tab-group>
            <wa-tab panel="general">{{ $t('General')}}</wa-tab>
            <wa-tab v-for="(tab, idx) of sections" :key="`instructions-tab-${idx}`"
                :panel="tab.module"
            >
                {{ $t(tab.label.short) }}
            </wa-tab>
            <wa-tab-panel name="general">
                <wa-callout>
                    <p>{{ $t(`Below are general use instructions. Feature-specific instructions can be found in their respective tabs.`)}}</p>
                </wa-callout>
                <wa-divider></wa-divider>
                <h3>{{ $t('Preferences') }}</h3>
                <p>{{ $t(`You can change the application preferences in the Settings menu.`) }}</p>
                <p>{{
                    $t(
                        `On he menu bar on top of the page, select Settings > User preferences. ` +
                        `The settings are divided into general application settings and module-specific settings, each having their own tab.`
                    )
                }}</p>
                <p>
                    {{
                        $t(
                            `Many of the settings can be changed on-the-fly, while others require a page reload to take effect. ` +
                            `Settings that require a page reload are marked with an orange rotating arrow `
                        )
                    }}
                    <app-icon name="undo" class="inline"></app-icon>.
                    {{
                        $t(
                            `You will be prompted to reload the page after changing any of these settings. ` +
                            `Note that the reload will reset the application state, meaning that you may have to reopen any resources you were working with.`
                        )
                    }}
                </p>
                <h4>{{ $t(`Saving and clearing settings`) }}</h4>
                <p>{{
                    $t(
                        `Changed settings are saved into the browsers session storage, which survives page reloads. ` +
                        `If you want settings to be saved across browser tabs and sessions, you can opt to save them into a cookie (browser local storage). ` +
                        `The cookie can be cleared by switching this feature off.`
                    )
                }}</p>
                <h4>{{ $t(`Hotkey actions`) }}</h4>
                <p>{{
                    $t(
                        `The application and its modules support a variety of hotkey actions. ` +
                        `If you don't want these actions to be triggered by accident, you can require the use of the Alt (Windows) / Opt (Mac) key to be pressed simultaneously.`
                    )
                }}</p>
                <h4>{{ $t(`Interface language`) }}</h4>
                <p>{{
                    $t(`TBA`)
                }}</p>
                <h4>{{ $t(`Screen calibration`) }}</h4>
                <p>{{
                    $t(
                        `Many biological signals are expected to be viewed at standard calibrations. ` +
                        `Since a JavaScript application cannot get accurate information about the screen that is used, this calibration must be done manually. ` +
                        `To calibrate the screen, drag the right end of the ruler until the ruler is 10 cm / 4 inches long. ` +
                        `The screen is expected to have a 1:1 pixel ratio and the same value is also used for vertical scaling.`
                    )
                }}</p>
                <p>{{
                    $t(
                        `To calibrate the screen, drag the right end of the ruler until the ruler is 10 cm / 4 inches long. ` +
                        `The screen is expected to have a 1:1 pixel aspect ratio and the same value is also used for vertical scaling.`
                    )
                }}</p>
            </wa-tab-panel>
            <wa-tab-panel v-for="(tab, idx) of sections" :key="`instructions-panel-${idx}`"
                :name="tab.module"
            >
                <wa-callout v-if="tab.description">
                    <p>{{ $t(tab.description) }}</p>
                </wa-callout>
                <wa-divider></wa-divider>
                <div>{{ tab.content }}</div>
            </wa-tab-panel>
        </wa-tab-group>
    </wa-dialog>
</template>

<script lang="ts">
/**
 * This component provides instructions on how to use the application.
 */
import { defineComponent, ref, Ref, reactive } from "vue"
import { T } from "#i18n"
import { useStore } from "vuex"
import { useContext } from "../config"

export default defineComponent({
    name: 'AppInstructions',
    components: {
    },
    props: {
    },
    setup () {
        const store = useStore()
        const infoOpen = reactive({} as { [name: string]: boolean })
        /** Map of module names and settings that can be saved by the user. */
        const sections = [] as any
        for (const mod of store.state.INTERFACE.modules.keys()) {
            const { SCHEMAS } = useContext(store, mod)
            if (!SCHEMAS?.instructions) {
                continue
            }
            const schemaProps = {
                module: SCHEMAS.module,
                ...SCHEMAS.instructions,
            }
            sections.push(schemaProps)
        }
        // DOM
        const dialog = ref<HTMLDivElement>() as Ref<any>
        return {
            infoOpen,
            sections,
            dialog,
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
        toggleInfo (field: string, value?: boolean) {
            if (value !== undefined) {
                this.infoOpen[field] = value
            } else if (!this.infoOpen[field]) {
                // If false or doesn't exist yet.
                this.infoOpen[field] = true
            } else {
                this.infoOpen[field] = false
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
        this.dialog.addEventListener('sl-request-close', this.closeDialog)
    },
    beforeUnmount () {
        this.dialog.removeEventListener('sl-request-close', this.closeDialog)
    },
})
</script>

<style scoped>
[data-component="app-instructions"] {
    position: absolute;
    inset: 0;
    background-color: var(--epicv-background-overlay);
    z-index: 500;
}
[data-component="app-instructions"] sl-alert::part(message) {
    font-size: 1rem;
}
[data-component="app-instructions"] h3 {
    color: var(--epicv-text-emphasis);
}
[data-component="app-instructions"] h4 {
    color: var(--epicv-text-emphasis);
    font-size: 1.1rem;
    font-weight: 400;
    margin-top: 1.5rem;
}
[data-component="app-instructions"] p {
    line-height: 1.25rem;
}
</style>
