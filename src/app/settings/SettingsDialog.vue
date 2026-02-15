<template>
    <wa-dialog ref="dialog"
        class="epicv-dialog"
        :label="$t('Settings')"
        :style="`--width:40rem;`"
        @click.stop=""
    >
        <wa-scroller orientation="vertical">
            <wa-tab-group @wa-after-hide.stop="">
                <wa-tab panel="general" slot="nav">{{ $t('General')}}</wa-tab>
                <wa-tab v-for="(tab, idx) of sections" :key="`settings-tab-${idx}`"
                    :panel="tab.module"
                    slot="nav"
                >
                    {{ $t(tab.label.short) }}
                </wa-tab>
                <wa-tab-panel name="general">
                    <wa-callout>
                        <p>{{ $t(`These are general settings that apply to all parts of the application.`)}}</p>
                    </wa-callout>
                    <wa-switch
                        :checked="settings.storeLocally"
                        @change="saveSettingsChanged($event.target.checked)"
                    >
                        {{ $t('Use a cookie to store my settings locally.') }}
                        <app-icon
                            class="info wa-brand"
                            :id="`${ID}-cookie-icon`"
                            name="circle-question"
                            variant="light"
                            @click.prevent="toggleInfo('cookie')"
                        ></app-icon>
                        <wa-tooltip :for="`${ID}-cookie-icon`">{{ $t('More info') }}</wa-tooltip>
                    </wa-switch>
                    <wa-callout v-if="infoOpen.cookie || false">
                        <app-icon slot="icon" name="circle-info" variant="light"></app-icon>
                        <p>{{ $t("Settings can be stored locally, so you don't have to set them again every time you open the application. Stored settings will only be remembered when usin this browser on this device.") }}</p>
                        <p>{{ $t("By enabling this you consent to this application using a cookie to save the settings.")}}</p>
                    </wa-callout>
                    <wa-divider></wa-divider>
                    <wa-switch
                        :checked="settings['app.hotkeyAltOrOpt']"
                        @change="saveHotkeysAltOrOpt($event.target.checked)"
                    >
                        {{ $t('Require the alt or opt key to trigger hotkey actions.') }}
                        <app-icon
                            class="info wa-brand"
                            :id="`${ID}-hotkeys-icon`"
                            name="circle-question"
                            variant="light"
                            @click.prevent="toggleInfo('hotkeys')">
                        </app-icon>
                        <wa-tooltip :for="`${ID}-cookie-icon`">{{ $t('More info') }}</wa-tooltip>
                    </wa-switch>
                    <wa-callout v-if="infoOpen.hotkeys || false">
                        <app-icon slot="icon" name="circle-info" variant="light"></app-icon>
                        <p>{{ $t("Require either the alt key or the opt key (on Mac) to be pressed down in order for hotkey actions to trigger.") }}</p>
                        <p>{{ $t("This will block browser actions that require those keys.")}}</p>
                    </wa-callout>
                    <template v-if="isBiosignalViewEnabled">
                        <wa-divider></wa-divider>
                        <div class="mains-frequency">
                            <wa-select
                                :value="settings['app.mainsFrequency'].toString()"
                                @change="saveMainsFrequency($event.target.value)"
                            >
                                <wa-option value="50">{{ $t('50Hz') }}</wa-option>
                                <wa-option value="60">{{ $t('60Hz') }}</wa-option>
                                <wa-option value="0">{{ $t('-') }}</wa-option>
                            </wa-select>
                            <div>
                                {{ $t('Mains AC frequency') }}
                                <app-icon
                                    class="info wa-brand"
                                    :id="`${ID}-cookie-icon`"
                                    name="circle-question"
                                    variant="light"
                                    @click.prevent="toggleInfo('mains')"
                                ></app-icon>
                                <wa-tooltip :for="`${ID}-cookie-icon`">{{ $t('More info') }}</wa-tooltip>
                            </div>
                        </div>
                        <wa-callout v-if="infoOpen.mains || false">
                            <app-icon slot="icon" name="circle-info" variant="light"></app-icon>
                            <p>{{ $t("You can set the mains power frequency (50/60Hz) used by default filters here.")}}</p>
                            <p>{{ $t("Setting this will disable the option to choose the AC filter frequency, so be sure that all you datasets can only have this frequency AC artefact if you enable it.")}}</p>
                        </wa-callout>
                        <wa-alert v-if="infoOpen['mains-frequency'] || false">
                            <app-icon slot="icon" name="circle-info" variant="light"></app-icon>
                            <p>{{ $t("The mains frequency is used to calculate the mains signal in the biosignal viewer. It is set to 50Hz by default, but can be set to 60Hz for US/Canada.") }}</p>
                        </wa-alert>
                        <wa-divider></wa-divider>
                        <p>
                            {{ $t("Drag the end of the ruler to a length of 10 cm on your screen.") }}
                            <app-icon
                                class="info wa-brand"
                                :id="`${ID}-ruler-icon`"
                                name="circle-question"
                                variant="light"
                                @click="toggleInfo('ruler')"
                            ></app-icon>
                            <wa-tooltip :for="`${ID}-ruler-icon`">{{ $t('More info') }}</wa-tooltip>
                        </p>
                        <wa-callout v-if="infoOpen.ruler || false">
                            <app-icon slot="icon" name="circle-info" variant="light"></app-icon>
                            <p>{{ $t("Pixel size calibration is required to guarantee that signals are scaled correctly along the time and amplitude axes. Web browsers hava no access to this information so it has to be set manually.") }}</p>
                        </wa-callout>
                        <screen-calibrator
                            :default="settings['app.screenPPI']"
                            v-on:value-changed="saveScreenPPI"
                        />
                    </template>
                </wa-tab-panel>
                <wa-tab-panel v-for="(tab, idx) of sections" :key="`settings-panel-${idx}`"
                    :name="tab.module"
                >
                    <wa-callout v-if="tab.description">
                        <p>{{ $t(tab.description) }}</p>
                    </wa-callout>
                    <template v-for="(field, idy) of tab.fields" :key="`module-settings-${idy}`">
                        <template v-if="!field.service || $store.state.SERVICES.get(field.service)">
                            <wa-divider v-if="field.type === 'subtitle' && (idy || tab.description)"></wa-divider>
                            <h5 v-if="field.type === 'subtitle'">
                                {{ $t(field.text || `\{\{ Missing subtitle text \}\}`) }}
                                <app-icon
                                    class="info wa-brand"
                                    :id="`${ID}-${tab.label.short}-field-${idy}-icon`"
                                    name="circle-question"
                                    variant="light"
                                    @click.prevent="toggleInfo(`tab-${idx}-field-${idy}`)"
                                ></app-icon>
                                <wa-tooltip :for="`${ID}-${tab.label.short}-field-${idy}-icon`">
                                    {{ $t('More info') }}
                                </wa-tooltip>
                            </h5>
                            <component v-else :is="field.component"
                                :class="[
                                    field.type,
                                    { 'last': idy === (tab.fields.length - 1) }
                                ]"
                                :default="getFieldDefault(tab.module, field.setting || '')"
                                :disabledTooltip="getFieldDisabledTooltip(tab.module, field) || undefined"
                                :field="field"
                                v-on:select-preset="selectPreset(field.presets || [])"
                                v-on:value-changed="saveOption(field.setting || '', $event, field.requiresReload)"
                            ></component>
                            <wa-callout v-if="field.info && infoOpen[`tab-${idx}-field-${idy}`]">
                                <app-icon slot="icon" name="circle-info" variant="light"></app-icon>
                                <p>{{ $t(field.info) }}</p>
                            </wa-callout>
                        </template>
                    </template>
                </wa-tab-panel>
            </wa-tab-group>
        </wa-scroller>
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
import ScreenCalibrator from '#app/settings/ScreenCalibrator.vue'
import SettingsCheckbox from '#app/settings/SettingsCheckbox.vue'
import SettingsColorpicker from '#app/settings/SettingsColorpicker.vue'
import SettingsDropdown from '#app/settings/SettingsDropdown.vue'
import SettingsNumber from '#app/settings/SettingsNumber.vue'
import SettingsPreset from '#app/settings/SettingsPreset.vue'
import { EpiCStore } from "#store"
import { EegInterfaceSchemas } from "#app/modules/eeg/types"
import { SettingsValue } from "@epicurrents/core/types"
import { Log } from 'scoped-event-log'

const FIELDS = {
    ScreenCalibrator,
    SettingsCheckbox,
    SettingsColorpicker,
    SettingsDropdown,
    SettingsNumber,
    SettingsPreset,
}

type SettingsSection = EegInterfaceSchemas['settings'] & { module: string }

export default defineComponent({
    name: 'SettingsDialog',
    components: {
        ...FIELDS,
    },
    props: {
    },
    setup () {
        const store = useStore() as EpiCStore
        const fadeBottom = ref(true)
        const fadeTop = ref(true)
        const infoOpen = reactive({} as { [name: string]: boolean })
        /** A map of settings that require a reload to take full effect, with `initial` and `current` values. */
        const requireReload = new Map() as Map<string, { initial: SettingsValue, current: SettingsValue }>
        /**
         * This item holds all the locally stored settings.
         * We only save the settings that the user has actually modified.
         */
        const settings = {
            storeLocally: false,
            // We want to save when the user accepted the disclaimer in the cookie.
            'app.disclaimerAccepted': store.state.INTERFACE.app.disclaimerAccepted,
            'app.hotkeyAltOrOpt': store.state.INTERFACE.app.hotkeyAltOrOpt,
            'app.mainsFrequency': store.state.INTERFACE.app.mainsFrequency,
            'app.screenPPI': store.state.INTERFACE.app.screenPPI,
        } as { [field: string]: any }
        const sections = [] as SettingsSection[]
        /** Map of module names and settings that can be saved by the user. */
        const userSettings = new Map<string, Map<string, boolean>>()
        for (const mod of store.state.INTERFACE.modules.keys()) {
            const { SCHEMAS, SETTINGS } = useContext(store, mod)
            if (!SCHEMAS?.settings) {
                continue
            }
            const schemaProps = {
                module: SCHEMAS.module,
                ...SCHEMAS.settings,
            } as SettingsSection
            sections.push(schemaProps)
            if (SETTINGS._userDefinable) {
                const userDefs = new Map<string, boolean>()
                for (const setName of Object.keys(SETTINGS._userDefinable)) {
                    userDefs.set(setName, true)
                }
                userSettings.set(mod, userDefs)
            }
        }
        // Check for possible locally stored settings.
        const local = window.localStorage.getItem('epicurrents')
        if (local) {
            const session = JSON.parse(window.sessionStorage.getItem('epicurrents') || '{}')
            // Require this to also be set in session settings or no session settings to exist yet.
            // This way we can have multiple tabs open with only one of them using local storage.
            if (!session.settings || session.settings.storeLocally) {
                settings.storeLocally = true
            }
        }
        // DOM
        const dialog = ref<HTMLDivElement>() as Ref<any>
        const wrapper = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            fadeBottom,
            fadeTop,
            infoOpen,
            requireReload,
            sections,
            settings,
            userSettings,
            //DOM
            dialog,
            wrapper,
            // Scope
            useContext,
            ...useActiveContext(store),
        }
    },
    computed: {
        isBiosignalViewEnabled () {
            return this.$store.state.APP.availableViews.includes('biosignal')
        },
    },
    watch: {
        open (value) {
            if (!value) {
                // If settings are stored and a change requires reload, suggest it on closing the dialog.
                for (const reqReload of this.requireReload.values()) {
                    if (reqReload.initial !== reqReload.current) {
                        this.$emit('suggest-reload')
                        break
                    }
                }
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
        closeDialog (event: Event) {
            event.preventDefault()
            this.$emit('close')
        },
        getFieldDefault (mod: string, field: string) {
            if (!mod || !field) {
                return undefined
            }
            const fieldVal = this.getFieldValue(field)
            const modSect = this.sections.filter(s => s.module === mod)[0]
            const sectField = modSect?.fields?.filter(f => f.setting === field)[0]
            const valueMap = sectField?.valueMap?.filter(m => m[0] === fieldVal)[0]
            return valueMap !== undefined ? valueMap[1] : fieldVal
        },
        getFieldDisabledTooltip (mod: string, field: EegInterfaceSchemas['settings']['fields'][number]) {
            const setting = field.setting?.replace(`${mod}.`, '') || ''
            const canSet = this.userSettings.get(mod)?.get(setting)
            if (field.type === 'setting' && !canSet) {
                return this.$t('This setting cannot be changed by the user.')
            }
            if (field.memoryManager && !this.RUNTIME.SETTINGS.app.useMemoryManager) {
                return this.$t('This setting requires the memory manager to be enabled.')
            }
            if (field.memoryManager === false && this.RUNTIME.SETTINGS.app.useMemoryManager) {
                return this.$t('This setting cannot be used with the memory manager enabled.')
            }
            return false
        },
        overlayClicked () {
            this.$emit('close')
        },
        saveHotkeysAltOrOpt (value: boolean) {
            this.$store.dispatch('set-settings-value', { field: 'app.hotkeyAltOrOpt', value: value })
            this.settings['app.hotkeyAltOrOpt'] = this.$store.state.INTERFACE.app.hotkeyAltOrOpt
        },
        saveMainsFrequency (value: string) {
            this.$store.dispatch('set-settings-value', { field: 'app.mainsFrequency', value: parseInt(value) })
            this.settings['app.mainsFrequency'] = this.$store.state.INTERFACE.app.mainsFrequency
        },
        saveOption (field: string, value: any, requiresReload = false) {
            if (requiresReload) {
                if (this.requireReload.has(field)) {
                    this.requireReload.get(field)!.current = value
                } else {
                    this.requireReload.set(field, {
                        initial: this.RUNTIME.SETTINGS.getFieldValue(field),
                        current: value,
                    })
                }
            }
            // Save value to user defined settings (in case local storage is activated later).
            const modField = field.match(/^(.+?)\.(.+)$/)
            if (modField) {
                this.settings[field] = value
                const modSect = this.sections.filter(s => s.module === modField[1])[0]
                const sectField = modSect?.fields?.filter(f => f.setting === modField[0])[0]
                const valueMap = sectField?.valueMap?.filter(m => m[1] === value)[0]
                if (valueMap) {
                    value = valueMap[0]
                }
            }
            this.$store.dispatch('set-settings-value', { field: field, value: value })
        },
        saveScreenPPI (value: number) {
            this.$store.dispatch('set-settings-value', { field: 'app.screenPPI', value: value })
            this.settings['app.screenPPI'] = this.$store.state.INTERFACE.app.screenPPI
        },
        saveSettingsChanged (value: boolean) {
            this.settings.storeLocally = value
            if (!value) {
                // Clear all locally stored data
                window.localStorage.clear()
                this.updateSettings()
            } else {
                this.updateSettings(true)
            }
        },
        selectPreset (presets: { setting: string, value: SettingsValue }[]) {
            for (const prst of presets) {
                this.saveOption(prst.setting, prst.value)
            }
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
        updateSettings (createStore = false) {
            const session = JSON.parse(window.sessionStorage.getItem('epicurrents') || '{}')
            // Fetch the time the user accepted the disclaimer.
            this.settings['app.disclaimerAccepted'] = this.$store.state.INTERFACE.app.disclaimerAccepted
            // Update the session and local storages with the new settings.
            Object.assign(session.settings, this.settings)
            window.sessionStorage.setItem('epicurrents', JSON.stringify(session))
            const local = window.localStorage.getItem('epicurrents')
            if (local) {
                const app = JSON.parse(local)
                Object.assign(app.settings, this.settings)
                window.localStorage.setItem('epicurrents', JSON.stringify(app))
                Log.debug('Local storage updated.', this.$options.name!)
            } else if (createStore) {
                window.localStorage.setItem('epicurrents', JSON.stringify({ settings: this.settings }))
                Log.debug('Local storage set up.', this.$options.name!)
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
    },
    beforeUnmount () {
    },
})
</script>

<style scoped>
.epicv-dialog::part(body) {
    max-height: 100%;
    padding-right: 0.5rem;
}
.epicv-dialog h5 {
    margin-bottom: 1rem;
}
.epicv-dialog wa-tab-panel::part(base) {
    padding: 1rem 0 0.5rem 0;
}
.epicv-dialog wa-callout {
    margin-bottom: 0.5rem;
}
.epicv-dialog wa-divider {
    margin: 1rem 0;
}
.epicv-dialog wa-scroller::part(content) {
    padding-right: 0.5rem;
    max-height: 85vh;
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
.content {
    margin: 0 10px 10px 10px;
    border: 1px solid var(--epicv-border-faint);
    border-bottom-left-radius: 5px;
    border-bottom-right-radius: 5px;
    border-top-right-radius: 5px;
}
.tabdesc {
    padding: 10px 10px 0 10px;
}
.subtitle {
    height: 25px;
    line-height: 25px;
    margin-top: 10px;
    padding: 0 10px;
    background-color: var(--epicv-background-emphasize);
}
.description {
    position: relative;
    padding: 10px 10px 10px 36px;
    font-size: 0.9em;
    background-color: var(--epicv-background-highlight)
}
    .description .icon {
        position: absolute;
        top: 50%;
        left: 10px;
        -ms-transform: translateY(-50%);
        transform: translateY(-50%);
        height: 16px;
        margin: 0;
        color: var(--epicv-text-faint);
    }
.last {
    padding-bottom: 10px;
}
.mains-frequency {
    display: flex;
}
    .mains-frequency wa-select {
        flex: 0 0 6.25rem;
    }
    .mains-frequency div {
        flex: 1;
        height: 2.5rem;
        line-height: 2.5rem;
        padding-left: 0.5rem;
    }
</style>
