<template>
    <wa-dropdown data-component="context-menu"
        :open="true"
        ref="component"
        @wa-after-hide="handleAfterHide"
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
import { HOST_ACTION, hostActionItems, runHostAction } from "#app/views/biosignal/hostActions"
import type {
    ContextMenuAction,
    ContextMenuActionContext,
    ContextMenuTarget,
    EpicurrentsApp,
    SettingsColor,
} from "@epicurrents/core/types"
import { SignalSelectionLimit } from "#types/interface"
import type { default as WaDropdown } from "@awesome.me/webawesome/dist/components/dropdown/dropdown.js"

/** What the menu of an event knows of it. */
type AnnotationProps = {
    id: string
    /** Whether the event is locked against editing. */
    locked: boolean
    /** The event's name, as the events list shows it. */
    name: string
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
        /**
         * The context a host action is given, or null when the menu is on nothing an action can be offered for.
         */
        actionContext (): ContextMenuActionContext | null {
            const target = this.context.target as ContextMenuTarget
            if ((target !== 'annotation' && target !== 'plot') || !this.RESOURCE) {
                return null
            }
            const annotation = target === 'annotation'
                ? this.RESOURCE.events.find(e => e.id === (this.context.props as AnnotationProps).id) ?? null
                : null
            if (target === 'annotation' && !annotation) {
                return null
            }
            return {
                annotation: annotation,
                channel: this.context.channel?.name ?? null,
                resource: this.RESOURCE,
                target: target,
                timestamp: this.context.timestamp,
            }
        },
        /** The actions hosts registered on the application. */
        hostActions (): Map<string, ContextMenuAction> {
            const app = window.__EPICURRENTS__?.APP as EpicurrentsApp | null
            return app?.getContextMenuActions() ?? new Map()
        },
        /**
         * Report the menu closed, which it does by itself on a click outside it. A submenu closing reports the same
         * event, and leaves the menu open.
         * @param event - The hide event.
         */
        handleAfterHide (event: Event) {
            if (event.target === this.component) {
                this.$emit('close')
            }
        },
        executeAction (action?: string, value?: string | number) {
            if (!action) {
                return
            }
            if (action.startsWith(HOST_ACTION)) {
                // The menu closes before the action runs, so an action that opens something of its own is not
                // covered by the menu.
                const context = this.actionContext()
                this.$emit('close')
                if (context) {
                    runHostAction(this.hostActions(), action.slice(HOST_ACTION.length), context)
                }
            } else if (action === 'create-channel-annotation') {
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
            const annotation = this.context.props as AnnotationProps
            const annotationOptions = [
                {
                    label: annotation.name,
                    type: 'label',
                },
                {
                    action: 'delete-annotation',
                    disabled: annotation.locked || this.RESOURCE.annotationsLocked,
                    icon: 'trash',
                    label: T('Delete event'),
                    type: 'item',
                    value: annotation.id,
                    variant: 'danger',
                },
            ] as ItemProps[]
            this.contextOptions.push(...annotationOptions)
        } else if (this.context.target === 'plot') {
            const plotOptions = [] as ItemProps[]
            if (this.context.channel) {
                // Add channel options if context has channel information.
                plotOptions.push({
                    action: 'create-channel-annotation',
                    disabled: this.RESOURCE.annotationsLocked,
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
                disabled: this.RESOURCE.annotationsLocked,
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
        const context = this.actionContext()
        const hostItems = context ? hostActionItems(this.hostActions(), context) : []
        if (hostItems.length) {
            this.contextOptions.push({ label: '', type: 'divider' }, ...hostItems)
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
