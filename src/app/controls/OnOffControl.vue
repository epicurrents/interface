<template>
    <wa-button ref="control"
        appearance="epicv"
        :class="[
            'control',
            { 'active': value },
            { 'join-left': joinLeft },
            { 'join-right': joinRight },
            { 'row-first': firstInRow },
        ]"
        data-component="onoff-control"
        :disabled="!enabled"
        :id="id"
        variant="brand"
        @click="toggleState"
    >
        <app-icon ref="icon"
            :name="iconName"
        ></app-icon>
    </wa-button>
    <wa-tooltip v-if="label"
        :for="id"
    >
        {{ label }}
    </wa-tooltip>
</template>

<script lang="ts">
/**
 * A small footer below the viewer for information display.
 */
import { defineComponent, PropType, Ref, ref } from "vue"
import { T } from "#i18n"
import { useStore } from "vuex"
import { useBiosignalContext } from '#root/src/config'

export default defineComponent({
    name: 'OnOffControl',
    props: {
        id: {
            type: String,
            required: true,
        },
        enabled: {
            type: Boolean,
            default: true,
        },
        firstInRow: {
            type: Boolean,
            default: false,
        },
        iconName: {
            type: String,
            required: true,
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
        onclick: {
            type: [String, Array],
            required: true,
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
            type: Boolean,
            default: false,
        },
        width: {
            type: Number,
            required: false,
        },
    },
    setup (/*props*/) {
        const store = useStore()
        // Save a pointer the the active resource. Otherwise it will be inaccessible before we have a
        // chance to clean up (unmount is triggered by the active resource changing).
        const active = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const control = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        /** True for on, false for off. */
        // Unsubscribe from store mutations
        const unsubscribe = ref([] as (() => void)[])
        return {
            active,
            control,
            // Unsubscribers
            unsubscribe,
            ...useBiosignalContext(store)
        }
    },
    computed: {
        controlsHeight (): string  {
            return this.$store.state.INTERFACE.app.controlsBarHeight
        }
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
        reloadComponent () {
            this.$nextTick(() => {
                this.$emit('reload')
            })
        },
        /**
         * Toggle value on-off.
         */
        toggleState () {
            if (!this.enabled) {
                return
            }
            // If the onclick is an array, we assume it is a store action with an argument.
            if (Array.isArray(this.onclick)) {
                const [action, arg] = this.onclick as [string, unknown]
                // Dispatch the action with the argument.
                this.$store.dispatch(action, arg)
            } else if (typeof this.onclick === 'string') {
                // If the onclick is a string, we assume it is a store action without an argument.
                this.$store.dispatch(this.onclick)
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
            } else if (scope === 'action') {
                this.unsubscribe.push(
                    this.$store.subscribeAction((action) => {
                        if (action.type === prop) {
                            this.reloadComponent()
                        }
                    })
                )
            }
        }
    },
    beforeUnmount () {
        // Remove property update handlers
        this.RESOURCE?.removeAllEventListeners(this.ID)
        this.$store.state.SERVICES.get('ONNX')?.removeAllEventListeners(this.ID)
        // Unsubscribe from actions
        this.unsubscribe.forEach((unsub) => unsub())
    }
})
</script>

<style scoped>
.control {
    width: v-bind(controlsHeight);
    height: v-bind(controlsHeight);
    margin-left: 0.5rem;
    background-color: var(--epicv-background);
    text-align: center;
    overflow: hidden;
    /* Setting a smaller font size here and resetting it in the label prevents the control size from changing. */
    font-size: 0.8rem;
    border-left: 1px solid var(--epicv-border-faint);
    border-right: 1px solid var(--epicv-border-faint);
}
    .control.join-left {
        margin-left: 0;
        border-left: none;
    }
    .control.join-right {
        border-right: none;
    }
    .control.row-first {
        margin-left: 0;
    }
    .control::part(base),
    .control::part(label),
    .control::part(prefix),
    .control::part(suffix) {
        height: v-bind(controlsHeight);
        max-height: v-bind(controlsHeight);
        min-height: v-bind(controlsHeight);
    }
    .control::part(base) {
        border: none;
        border-radius: 0;
    }
    .control::part(label) {
        padding: 0;
        /* Increase icon size without changing control size. */
        font-size: 1.25em;
    }
    .control::part(base):focus  {
        outline: none;
        box-shadow: var(--epicv-button-focused);
    }
    .control.active::part(base) {
        box-shadow: var(--epicv-button-focused);
    }
</style>
