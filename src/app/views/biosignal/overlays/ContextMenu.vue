<template>
    <wa-dropdown data-component="context-menu"
        :open="true"
        ref="component"
        @keydown.stop=""
        @keyup.stop=""
    >
        <wa-button slot="trigger"></wa-button>
        <h6 v-if="context.channel">{{ context.channel.label }}</h6>
        <template v-for="(item, _idx) of contextOptions"
            :key="`eeg-menu-${context.target}-${_idx}`"
        >
            <h6 v-if="item.type === 'label'">{{ item.label }}</h6>
            <wa-divider v-else-if="item.type === 'divider'"></wa-divider>
            <wa-dropdown-item v-else
                :disabled="item.disabled || false"
                :variant="item.variant || 'regular'"
                @click="item.type === 'item' && !item.disabled ? executeAction(item.action, item.value): null"
            >
                <app-icon v-if="item.icon"
                    :name="item.icon"
                    :rotate="item.rotate"
                    slot="icon"
                    variant="light"
                ></app-icon>
                {{ item.label }}
                <wa-dropdown v-if="item.type === 'submenu'" slot="submenu">
                    <template v-for="(subitem, _idy) of item.subItems"
                        :key="`eeg-menu-${context.target}-${_idy}`"
                    >
                        <h6 v-if="subitem.type === 'label'">{{ subitem.label }}</h6>
                        <wa-dropdown-item v-else
                            :disabled="subitem.disabled || false"
                            :variant="subitem.variant || 'regular'"
                            @click.stop="!subitem.disabled ? executeAction(subitem.action, subitem.value): null"
                        >
                            <app-icon v-if="subitem.icon"
                                :name="subitem.icon"
                                :rotate="subitem.rotate"
                                slot="icon"
                                variant="light"
                            ></app-icon>
                            {{ subitem.label }}
                        </wa-dropdown-item>
                    </template>
                </wa-dropdown>
            </wa-dropdown-item>
        </template>
    </wa-dropdown>
</template>

<script lang="ts">
/**
 * Context menu for EEG plot interactions.
 */
import { defineComponent, PropType, ref, Ref } from "vue"
import { T } from "#i18n"

import { ContextMenuContext } from "#types/interface"
import { useStore } from "vuex"
import { useBiosignalContext } from "#config"
import { SettingsColor } from "@epicurrents/core/dist/types"
import { SignalSelectionLimit } from "#types/interface"
import type { default as WaDropdown } from "@awesome.me/webawesome/dist/components/dropdown/dropdown.js"

type AnnotationProps = {
    id: string
}
type ItemProps = {
    /** User-facing item label. */
    label: string
    type: 'divider' | 'item' | 'label' | 'submenu'
    /** Click action for this item. */
    action?: string
    /** Label and icon color. */
    color?: SettingsColor
    /** Is this item disabled. */
    disabled?: boolean
    /** Prefix icon. */
    icon?: string
    /** Select options. */
    options?: ItemProps[]
    /** Icon rotation. */
    rotate?: string
    /** Submenu items. */
    subItems?: ItemProps[]
    /** The value to associate with the action. */
    value?: string | number
    /** Button variant. */
    variant?: string
}

export default defineComponent({
    name: 'EegContextMenu',
    props: {
        context: {
            type: Object as PropType<ContextMenuContext>,
            required: true,
        },
        extraItems: {
            type: Array as PropType<ItemProps[]>,
            default: [],
        },
        selectionBound: {
            type: Object as PropType<SignalSelectionLimit | null>,
            default: null,
        },
    },
    setup () {
        const store = useStore()
        const annotationClass = ref(0)
        const annotationText = ref('')
        const contextOptions = ref([] as ItemProps[])
        const component = ref<WaDropdown>() as Ref<WaDropdown>
        return {
            annotationClass,
            annotationText,
            contextOptions,
            component,
            ...useBiosignalContext(store),
        }
    },
    computed: {
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
        executeAction (action?: string, value?: string | number) {
            if (!action) {
                return
            }
            if (action === 'create-channel-annotation') {
                this.$emit(
                    'action',
                    {
                        action: 'create-events',
                        channels: [this.context.channel?.name],
                        code: this.annotationClass,
                        duration: 0,
                        start: this.context.timestamp,
                        text: this.annotationText,
                    }
                )
            } else if (action === 'create-global-annotation') {
                this.$emit(
                    'action',
                    {
                        action: 'create-events',
                        code: this.annotationClass,
                        duration: 0,
                        start: this.context.timestamp,
                        text: this.annotationText,
                    }
                )
            } else if (action === 'set-annotation-class') {
                this.annotationClass = value as number
            } else if (action === 'set-annotation-text') {
                this.annotationText = value as string
            } else {
                this.$emit('action', { action: action, context: this.context.target, value: value })
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
        if (this.context.target === 'annotation') {
            const annotationOptions = [
                {
                    label: T('Change type'),
                    type: 'submenu',
                    subItems: Object.values(this.SETTINGS.annotations.classes).map(c => {
                        return {
                            action: 'change-annotation-class',
                            label: T(c.label),
                            value: c.quickCode,
                        }
                    })
                },
                {
                    type: 'divider',
                },
                {
                    action: 'delete-annotation',
                    color: [0.5, 0, 0],
                    label: T('Delete annotation'),
                    type: 'item',
                    value: (this.context.props as AnnotationProps)?.id || '',
                },
            ] as ItemProps[]
            this.contextOptions.push(...annotationOptions)
        } else if (this.context.target === 'plot') {
            const plotOptions = [] as ItemProps[]
            if (this.context.channel) {
                // Add channel options if context has channel information.
                plotOptions.push({
                    action: 'create-channel-annotation',
                    icon: 'message-dots',
                    label: T('Create channel annotation'),
                    type: 'item',
                })
                plotOptions.push({
                    action: 'start-channel-selection',
                    icon: 'arrows-from-dotted-line',
                    label: T('Start channel selection'),
                    rotate: '90deg',
                    type: 'item',
                })
                plotOptions.push({
                    action: 'end-channel-selection',
                    disabled: !this.selectionBound || !this.selectionBound.channel,
                    icon: 'arrows-to-dotted-line',
                    label: T('End channel selection'),
                    rotate: '90deg',
                    type: 'item',
                })
                plotOptions.push({
                    label:  '',
                    type: 'divider',
                })
            }
            // Global options.
            plotOptions.push({
                action: 'create-global-annotation',
                icon: 'input-text',
                label: T('Create global annotation'),
                type: 'item',
            })
            plotOptions.push({
                action: 'start-global-selection',
                icon: 'arrows-from-dotted-line',
                label: T('Start global selection'),
                rotate: '90deg',
                type: 'item',
            })
            plotOptions.push({
                action: 'end-global-selection',
                disabled: !this.selectionBound || this.selectionBound.channel !== null,
                icon: 'arrows-to-dotted-line',
                label: T('End global selection'),
                rotate: '90deg',
                type: 'item',
            })
            if (this.selectionBound) {
                plotOptions.push({
                    label:  '',
                    type: 'divider',
                })
                plotOptions.push({
                    action: 'cancel-selection',
                    icon: 'circle-x',
                    label: T('Cancel selection'),
                    type: 'item',
                    variant: 'danger',
                })
            }
            this.contextOptions.push(...plotOptions)
        }
        requestAnimationFrame(() => {
            const parent = this.component.parentElement
            if (!parent) {
                return
            }
            // Calculate the menu height.
            let menuHeight = 12 // Menu padding and some space below the menu.
            for (const child of this.component.children) {
                menuHeight += (child as HTMLElement).offsetHeight
            }
            if (this.component.offsetWidth + this.context.position[0] < parent.offsetWidth) {
                this.component.skidding = this.context.position[0] + 8
            } else {
                this.component.skidding = this.context.position[0] - this.component.offsetWidth
            }
            this.component.distance = Math.min(
                parent.offsetHeight - menuHeight,
                parent.offsetHeight - this.context.position[1]
            )
        })
    },
})
</script>

<style scoped>
[data-component="context-menu"] {
    position: absolute;
    width: fit-content;
    height: fit-content;
    border-color: var(--epicv-border);
    z-index: 3;
    overflow: hidden;
}
    [data-component="context-menu"] wa-button[slot="trigger"] {
        height: 0;
        opacity: 0;
        pointer-events: none;
        width: 0;
    }
    [data-component="context-menu"] wa-dropdown-item {
        padding-left: 0.75rem;
        padding-right: 0.75rem;
        font-size: 0.85rem;
    }
    [data-component="context-menu"] wa-dropdown-item::part(checked-icon) {
        /* This context menu doesn't use checked icons */
        width: 0;
    }
    [data-component="context-menu"] h5 {
        line-height: 1.25rem;
    }
</style>
