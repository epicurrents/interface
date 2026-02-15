<template>
    <div data-component="dropdown-control"
        :class="[
            { 'disabled': !enabled },
            { 'join-left': joinLeft },
            { 'join-right': joinRight },
            { 'row-first': firstInRow },
        ]"
    >
        <div v-if="navButtons" class="buttons">
            <wa-button
                appearance="epicv"
                :disabled="enabled && nextItem ? undefined : true"
                variant="brand"
                @click="navigateTo(nextItem)"
            >
                <app-icon name="chevron-up"></app-icon>
            </wa-button>
            <wa-button
                appearance="epicv"
                :disabled="enabled && previousItem ? undefined : true"
                variant="brand"
                @click="navigateTo(previousItem)"
            >
                <app-icon name="chevron-down"></app-icon>
            </wa-button>
        </div>
        <wa-select ref="control"
            :class="[
                'control',
                { 'with-buttons': navButtons },
            ]"
            :disabled="!enabled"
            :label="$t(label)"
            :placeholder="placeholder"
            :value="value"
            size="small"
            @change="selectOption"
            @wa-hide="$event.target.blur()"
            @wa-input="$event.target.blur()"
        >
            <span v-if="prefix" slot="start">{{ prefix }}</span>
            <wa-option v-for="(option, idx) in options" :key="`${ID}-option-${idx}`"
                :class="{ 'has-suffix': !!option.suffix }"
                :value="option.id"
            >
                <app-icon v-if="option.icon" :name="option.icon" slot="start"></app-icon>
                {{ option.label }}
                <span v-if="option.suffix" class="suffix" slot="end">{{ option.suffix }}</span>
            </wa-option>
            <template v-for="(group, gIdx) in groups" :key="`${ID}-group-${gIdx}`">
                <wa-divider v-if="gIdx || options.length" :class="{ 'no-label': !group.label }"></wa-divider>
                <h6 v-if="group.label.length">{{ group.label }}</h6>
                <wa-option v-for="(option, oIdx) in group.items" :key="`${ID}-group-${gIdx}-option-${oIdx}`"
                    :class="{ 'has-suffix': !!option.suffix }"
                    :disabled="option.enabled === false ? true : false"
                    :value="option.id"
                >
                    <app-icon v-if="option.icon" :name="option.icon" slot="start"></app-icon>
                    {{ option.label }}
                    <span v-if="option.suffix" class="suffix" slot="end">{{ option.suffix }}</span>
                </wa-option>
            </template>
        </wa-select>
    </div>
</template>

<script lang="ts">
/**
 * A small footer below the viewer for information display.
 */
import { defineComponent, PropType, Ref, ref } from "vue"
import { T } from "#i18n"
import { useStore } from "vuex"
import { DataResource } from "@epicurrents/core/types"
import { DropdownGroup, DropdownItem } from "#types/interface"
import { useActiveContext } from '#root/src/config'

export default defineComponent({
    name: 'DropdownControl',
    components: {
    },
    props: {
        enabled: {
            type: Boolean,
            default: true,
        },
        firstInRow: {
            type: Boolean,
            default: false,
        },
        joinLeft: {
            type: Boolean,
            default: false,
        },
        joinRight: {
            type: Boolean,
            default: false,
        },
        label: {
            type: String,
            required: true,
        },
        groups: {
            type: Array as PropType<DropdownGroup[]>,
            default: [],
        },
        navButtons: {
            type: Boolean,
            default: false,
        },
        options: {
            type: Array as PropType<DropdownItem[]>,
            default: [],
        },
        placeholder: {
            type: String,
            default: '',
        },
        prefix: {
            type: String,
            default: '',
        },
        reloadOn: {
            type: Array as PropType<string[]>,
            default: [],
        },
        suffix: {
            type: String,
            default: '',
        },
        value: {
            type: [String, Number],
            default: '',
        },
        width: {
            type: Number,
            default: 0,
        },
    },
    setup () {
        const store = useStore()
        // Save a pointer the the active resource. Otherwise it will be inaccessible before we have a
        // chance to clean up (unmount is triggered by the active resource changing).
        const RESOURCE = store.getters.getActiveResource() as DataResource
        //const active = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const control = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        // Unsubscribe from store mutations
        const unsubscribe = ref([] as (() => void)[])
        return {
            control,
            // Unsubscribers
            unsubscribe,
            RESOURCE,
            ...useActiveContext(useStore()),
        }
    },
    computed: {
        controlsHeight (): string  {
            return this.$store.state.INTERFACE.app.controlsBarHeight
        },
        nextItem (): DropdownItem | null {
            for (let i=0; i<this.options.length; i++) {
                if (i < this.options.length - 1 && this.options[i].id === this.value) {
                    return this.options[i + 1]
                }
            }
            for (const group of this.groups) {
                for (let i=0; i<group.items.length; i++) {
                    if (i < group.items.length - 1 && group.items[i].id === this.value) {
                        return group.items[i + 1]
                    }
                }
            }
            return null
        },
        previousItem (): DropdownItem | null {
            for (let i=0; i<this.options.length; i++) {
                if (i && this.options[i].id === this.value) {
                    return this.options[i - 1]
                }
            }
            for (const group of this.groups) {
                for (let i=0; i<group.items.length; i++) {
                    if (i && group.items[i].id === this.value) {
                        return group.items[i - 1]
                    }
                }
            }
            return null
        },
        optionActions (): Map<string, [string, any]> {
            const actions = new Map<string, [string, any]>()
            for (const opt of this.options) {
                actions.set(opt.id, opt.onclick)
            }
            for (const grp of this.groups) {
                for (const opt of grp.items) {
                    actions.set(opt.id, opt.onclick)
                }
            }
            return actions
        }
    },
    methods: {
        /**
         * Override the default I18n translate method.
         * Returns a specific translation (default) or a
         * general translation (fallback) for the given key string.
         */
        $t: function (key: string, params = {}, capitalized = false) {
            return T(key, this.$options.name, params, capitalized)
        },
        reloadComponent () {
            // Update version to force reload, but allow time for propagation
            this.$nextTick(() => {
                this.$emit('reload')
            })
        },
        navigateTo (item: DropdownItem | null) {
            if (!item?.enabled) {
                return
            }
            this.$emit('selected', item)
        },
        selectOption (event: CustomEvent) {
            const { disabled, value } = event.target as any
            if (!disabled) {
                this.$emit('selected', { id: value, onclick: this.optionActions.get(value) || ['', null] })
            }
        },
    },
    beforeMount () {
        // Add component styles to shadow root
        this.$store.dispatch('add-component-styles', { component: this.$options.name, styles: this.$options.__scopeId })
    },
    mounted () {
        // Set width
        this.control.style.width = this.width ? this.width + 'px' : '100%'
        // Listen to set property changes in the recording
        for (const reload of this.reloadOn) {
            const [scope, prop] = reload.split(':')
            if (!scope || !prop) {
                continue
            }
            const ONNX = this.$store.state.SERVICES.get('ONNX')
            if (scope === 'settings') {
                this.unsubscribe.push(
                    this.$store.subscribe((mutation) => {
                        const matchSubProps = prop.endsWith('.')
                        if (
                            mutation.type === 'set-settings-value' &&
                            (matchSubProps ? mutation.payload.field.startsWith(prop) : mutation.payload.field === prop)
                        ) {
                            this.reloadComponent()
                        }
                    })
                )
            } else if (scope === 'resource') {
                this.RESOURCE.onPropertyChange(prop as keyof typeof this.RESOURCE, this.reloadComponent, this.ID)
            } else if (scope === 'onnx' && ONNX) {
                ONNX.onPropertyChange(prop as keyof typeof ONNX, this.reloadComponent, this.ID)
            }
        }
    },
    beforeUnmount () {
        // Remove property update handlers
        this.$store.state.SETTINGS.removeAllPropertyUpdateHandlersFor(this.ID)
        this.RESOURCE?.removeAllEventListeners(this.ID)
        this.$store.state.SERVICES.get('ONNX')?.removeAllEventListeners(this.ID)
        // Unsubscribe from actions
        this.unsubscribe.forEach((unsub) => unsub())
    }
})
</script>
<style scoped>
[data-component="dropdown-control"] {
    display: flex;
    margin-left: 1rem;
    /** Leave one pixel to display the focus outline. */
    padding-right: 1px;
    border-left: 1px solid var(--epicv-border-faint);
    border-right: 1px solid var(--epicv-border-faint);
}
    [data-component="dropdown-control"].join-left {
        margin-left: 0;
        border-left: none;
    }
    [data-component="dropdown-control"].join-right {
        border-right: none;
    }
    [data-component="dropdown-control"].row-first {
        margin-left: 0;
    }
.buttons {
    display: flex;
    flex-flow: column nowrap;
    flex: 0 0 1.125rem;
    max-width: 1.125rem;
    font-size: 0.75rem;
}
    .buttons wa-button {
        flex: 0 0 1.25rem;
        font-size: 0.33rem;
        margin: 0 0.25rem;
        width: 1.125rem;
        max-width: 1.125rem;
    }
    [data-component="dropdown-control"].disabled .buttons wa-button[disabled]::part(base) {
        background-color: var(--sl-input-background-color-disabled);
    }
    .buttons wa-button::part(base) {
        box-shadow: none;
        outline: none;
        border: none;
        border-width: 0;
        border-radius: 0;
    }
    .buttons wa-button::part(base):focus-visible {
        /* Raise the button a bit to show it fully when focused. */
        position: relative;
        z-index: 10;
        /* Focused button highlight. */
        box-shadow: var(--epicv-button-focused);
    }
    .buttons wa-button::part(label) {
        font-size: 1.75em;
    }
.control::part(form-control-input) {
    height: v-bind(controlsHeight);
}
.control::part(combobox) {
    height: v-bind(controlsHeight);
    min-height: v-bind(controlsHeight);
    padding-left: 0.5rem;
    padding-right: 0;
    line-height: 1;
    border: none;
    overflow: hidden;
}
    .control.join-left::part(combobox) {
        border-left: none;
    }
    /*.control.with-buttons::part(combobox) {
        padding-left: 0.25rem;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;

    }*/
.control::part(form-control-label) {
    color: var(--epicv-text-minor);
    position: absolute;
    top: 2px;
    padding: 0 2rem 0 0.5rem;
    margin: 0;
    height: 1em;
    font-size: 0.6rem;
    pointer-events: none;
    z-index: 1;
}
.control::part(display-input) {
    flex: 1 1 auto;
    position: relative;
    top: 0.4rem;
}
.control::part(form-control) {
    position: relative;
}
.control span[slot=end] {
    margin-inline-start: 0.25rem;
}
.control::part(end) {
    font-size: 0.75rem;
    position: relative;
    top: 0.45rem;
    pointer-events: none;
    white-space: nowrap;
}
    /*.control.with-buttons span[slot=help-text] {
        padding-left: 0.25rem;
    }*/
.control::part(listbox) {
    border-color: var(--epicv-border);
}
.control::part(expand-icon) {
    margin-inline-end: 0.25rem;
    margin-inline-start: 0.25rem;
}
.control.disabled::part(expand-icon) {
    /* Hide the expand icon if control is disabled. */
    display: none;
}
.control wa-option {
    padding: 0.5rem;
}
.control wa-option::part(checked-icon) {
    display: none;
}
.control wa-divider {
    margin: 0.25rem 0;
}
.control h6 {
    color: var(--epicv-text-minor);
    display: inline-block;
    height: 1.5em;
    padding: 0 0.6em;
    margin: 0.5em 0;
}
.control .suffix {
    font-size: 0.9em;
    opacity: 0.5;
}
</style>
