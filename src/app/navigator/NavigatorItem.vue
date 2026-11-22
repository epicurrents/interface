<template>
    <div data-component="navigator-item"
        :class="{
            'active': isShown,
            'child': parent,
            'disabled': !isSelectableNow,
            'failed': isFailed,
        }"
    >
        <div class="main">
            <button
                :aria-current="isShown || undefined"
                :aria-disabled="!isSelectableNow || undefined"
                class="select"
                @click="resourceClicked"
            >
                <span v-if="isReady || isListing || isRetryable" class="name epicv-oneliner">
                    {{ parseResourceName(resource.name) }}
                </span>
                <span v-else-if="isFailed" class="name epicv-oneliner">
                    {{ $t('Error loading resource') }}
                </span>
                <span v-else class="name epicv-oneliner">{{ $t('Loading resource') }}</span>
                <span class="properties epicv-oneliner">
                    <template v-for="(props, idx) of resourceProps" :key="`resource-property-${idx}`">
                        <span v-if="idx" class="separator"> | </span>
                        <app-icon v-if="props.icon"
                            :id="`nav-item-${resource.id}-${idx}-icon`"
                            :name="props.icon"
                        ></app-icon>
                        <wa-tooltip v-if="props.icon" :for="`nav-item-${resource.id}-${idx}-icon`">
                            {{ props.tooltip || '' }}
                        </wa-tooltip>
                        {{ props.text }}
                    </template>
                </span>
            </button>
            <wa-button v-if="isRetryable"
                appearance="plain"
                class="retry-button"
                :id="`retry-button-${resource.id}`"
                @click="resourceClicked"
            >
                <app-icon :label="$t('Try again')" name="rotate-right"></app-icon>
            </wa-button>
            <wa-tooltip v-if="isRetryable" :for="`retry-button-${resource.id}`">{{ $t('Try again') }}</wa-tooltip>
            <span v-else-if="!isReady && !resource.isListed" class="spinner">
                <wa-spinner v-if="!isFailed"></wa-spinner>
                <app-icon v-else class="error" name="octagon-exclamation"></app-icon>
            </span>
            <wa-button v-if="isShown"
                appearance="plain"
                class="close-button"
                :id="`close-button-${resource.id}`"
                @click="closeResource"
            >
                <app-icon :label="$t('Close resource')" :name="closeButtonIcon"></app-icon>
            </wa-button>
            <wa-tooltip v-if="isShown" :for="`close-button-${resource.id}`">{{ $t('Close resource') }}</wa-tooltip>
        </div>
        <button v-if="childCount"
            :aria-controls="expanded && childrenId ? childrenId : undefined"
            :aria-expanded="expanded"
            class="disclosure"
            @click="toggleChildren"
        >
            <app-icon :name="expanded ? 'chevron-down' : 'chevron-right'"></app-icon>
            {{ $t('{n} nested resources', { n: childCount }) }}
        </button>
    </div>
</template>

<script lang="ts">
/**
 * A row in the dataset navigator: a dataset member, or a resource listed under one.
 */
import { defineComponent, PropType, ref } from "vue"
import { T } from "#i18n"
import type { DataResource } from "@epicurrents/core/types"
import { useStore } from "vuex"
import { secondsToTimeString, timePartsToShortString } from "@epicurrents/core/util"

/**
 * Whether activating `resource` from the navigator is allowed. A listed study is activated to load it, and stays
 * selectable while it loads, since its view shows the loading state; a resource read from a file is selectable once it
 * is ready. A resource whose load failed stays selectable while it can be retried, since activating it is the retry;
 * one that stands in for a failure with nothing behind it is not. `wasListed` carries the listing past the start of
 * the load, which clears `isListed`.
 */
const isSelectable = (resource: DataResource, wasListed: boolean) => {
    if (resource.state === 'destroyed') {
        return false
    }
    if (resource.state === 'error') {
        return resource.canRetryLoad
    }
    return resource.isReady || wasListed || resource.isListed
}

// Child components

export default defineComponent({
    name: 'NavigatorItem',
    props: {
        /** The number of resources listed under this one, which gives a member its disclosure row. */
        childCount: {
            type: Number,
            default: 0,
        },
        /** Id of the element that holds the resources listed under this one while they are shown. */
        childrenId: {
            type: String,
            default: '',
        },
        /** Whether the resources listed under this one are shown. */
        expanded: {
            type: Boolean,
            default: false,
        },
        /** The resource this one is listed under as a child, or null for a dataset member. */
        parent: {
            type: Object as PropType<DataResource | null>,
            default: null,
        },
        resource: {
            type: Object as PropType<DataResource>,
            required: true,
        },
    },
    emits: ['selected', 'toggle-children'],
    setup () {
        const ID = 'NavigatorItem-' + useStore().state.APP.runningId++
        /** The resource is in `error`; its row shows the reason among its properties. */
        const isFailed = ref(false)
        /** The item lists a study that loads in place on its first activation, and keeps its name while it loads. */
        const isListing = ref(false)
        const isReady = ref(false)
        /** The resource failed and can be loaded again, which clicking the row or its retry control does. */
        const isRetryable = ref(false)
        /**
         * Whether the item marks the resource that is shown: active itself, or the active child of its active parent.
         * A collapsed member marks its shown child in its place.
         */
        const isShown = ref(false)
        /** Whether clicking the item activates its resource. */
        const isSelectableNow = ref(false)
        const resourceProps = ref([] as { [key: string]: string }[])
        return {
            ID,
            isFailed,
            isListing,
            isReady,
            isRetryable,
            isSelectableNow,
            isShown,
            resourceProps,
        }
    },
    computed: {
        closeButtonIcon (): string {
            // This can return a different icon, if the resource is set up to be destroyed after closing.
            return 'xmark'
        },
    },
    watch: {
        expanded () {
            this.resourceUpdated()
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
        closeResource () {
            this.$store.dispatch('set-active-resource', null)
        },
        parseResourceName (name: string) {
            // Simply use the part before the first dot (which is
            // usually followed by the file name extension).
            const firstDotPos = name.indexOf('.')
            return name.substring(0,(firstDotPos >= 0 ? firstDotPos : name.length))
        },
        resourceClicked () {
            if (!isSelectable(this.resource, this.isListing)) {
                return
            }
            if (this.parent) {
                this.$store.dispatch('set-active-child-resource', { child: this.resource, parent: this.parent })
            } else {
                this.$store.dispatch('set-active-resource', this.resource)
            }
            this.$emit('selected')
        },
        resourceUpdated () {
            const props = [] as { [key: string]: string }[]
            for (const [name, value] of this.resource.getMainProperties()) {
                if (value !== null) {
                    const strParams = {} as { [key: string]: string }
                    if (name === 'duration') {
                        const timeParts = secondsToTimeString(value as number, true) as number[]
                        const timeShort = timePartsToShortString(timeParts)
                        strParams.icon = 'clock'
                        strParams.text = timeShort
                        strParams.tooltip = this.$t('Duration: {t}', { t: secondsToTimeString(value as number) })
                        props.push(strParams)
                    } else if (name === 'pages') {
                        if (value === 1) {
                            strParams.text = this.$t('Single page')
                        } else {
                            strParams.text = this.$t('{n} pages', { n: value })
                            strParams.tooltip = this.$t('Document has a total of {n} pages', { n: value })
                        }
                        props.push(strParams)
                    } else if (name === 'signals') {
                        strParams.icon = 'wave-pulse'
                        strParams.text = value.toString()
                        strParams.tooltip = this.$t('{n} signals', { n: value })
                        props.unshift(strParams) // Show signals count first.
                    } else if (name === 'date' && value instanceof Date) {
                        // A collection reports its date under this key, which makes it the one main
                        // property whose key names a field rather than being the message itself.
                        // Falling through to the branch below hands the key to the translator, which
                        // resolves it to the locale's own `date` format and interpolates a `Date`
                        // into placeholders it has no properties for, rendering `//`.
                        //
                        // That format is where a date belongs, so the parts are passed as the
                        // parameters it asks for. Going through the locale rather than
                        // `toLocaleDateString` is also what keeps the order the user reads matching
                        // the language they chose in the application, which need not be the one the
                        // browser is set to.
                        const parts = {
                            y: value.getFullYear(),
                            m: value.getMonth() + 1,
                            d: value.getDate(),
                        }
                        const time = {
                            h: value.getHours(),
                            min: String(value.getMinutes()).padStart(2, '0'),
                        }
                        strParams.icon = 'calendar'
                        strParams.text = this.$t('date', parts)
                        strParams.tooltip = this.$t('Date: {d}', {
                            d: this.$t('datetime', { ...parts, ...time }),
                        })
                        props.push(strParams)
                    } else {
                        // State / dependency messages from `getMainProperties()` come back with the
                        // message text as the map key and a placeholder object as the value, e.g.
                        // `'Loading dependency {n}/{t}...'` → `{ n: 1, t: 2 }`. This branch takes
                        // every entry the two branches above do not name, so the value is any
                        // member of `MainProperty` — only the placeholder objects among them are
                        // meaningful as parameters, and the rest interpolate into nothing.
                        props.push({ text: this.$t(name, value as unknown as Record<string, unknown>) })
                    }
                } else if (name === 'pages') {
                    props.push({ text: this.$t('Not loaded yet') })
                } else {
                    // Plain state messages with no placeholders — `'Waiting to load...'`,
                    // `'Loading details...'`, `'Initializing...'`, or an error reason. The map
                    // key is the message itself.
                    props.push({ text: this.$t(name) })
                }
            }
            // The row leads with the resource's modality, named by the module registered for it.
            const module = this.$store.state.MODULES.get(this.resource.modality)
            if (module) {
                props.unshift({ text: this.$t(module.moduleName.short) })
            }
            this.isFailed = this.resource.state === 'error'
            this.isListing = this.isListing || this.resource.isListed
            this.isReady = this.resource.isReady
            this.isRetryable = this.isFailed && this.resource.canRetryLoad
            this.isSelectableNow = isSelectable(this.resource, this.isListing)
            this.isShown = this.parent
                           ? this.parent.isActive && this.parent.activeChildResource?.id === this.resource.id
                           : this.resource.isActive && (!this.resource.activeChildResource || !this.expanded)
            this.resourceProps = props
        },
        toggleChildren () {
            this.$emit('toggle-children')
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
        // Add property update handlers
        // The reason is followed on its own, since a resource may give it before or after it enters the error state.
        this.resource.onPropertyChange(
            ['activeChildResource', 'dependenciesReady', 'errorReason', 'isActive', 'isReady', 'state'],
            this.resourceUpdated,
            this.ID
        )
        this.parent?.onPropertyChange(['activeChildResource', 'isActive'], this.resourceUpdated, this.ID)
        // Check initial state.
        this.resourceUpdated()
    },
    beforeUnmount () {
        // Remove property update handlers
        this.resource.unsubscribeAll(this.ID)
        this.parent?.unsubscribeAll(this.ID)
    }
})
</script>

<style scoped>
/* Rows are borderless. The shown row carries a light background and the others a hover tint. */
[data-component="navigator-item"] {
    /* A child's name starts where the text of its parent's disclosure row does, after the caret. */
    --disclosure-caret: 0.875rem;
    --disclosure-gap: 0.25rem;
    --disclosure-padding: 0.375rem;
    border-radius: 0.25rem;
    display: flex;
    flex-direction: column;
    width: 100%;
}
    [data-component="navigator-item"]:hover:not(.disabled) {
        background-color: var(--epicv-background-active);
    }
    [data-component="navigator-item"].active,
    [data-component="navigator-item"].active:hover {
        background-color: var(--epicv-background-hover);
    }
    [data-component="navigator-item"].disabled {
        opacity: 0.5;
    }
button {
    appearance: none;
    background: none;
    border: 0;
    color: inherit;
    cursor: pointer;
    font: inherit;
    padding: 0;
}
    button:focus-visible {
        border-radius: 0.25rem;
        outline: 2px solid var(--epicv-border-active);
        outline-offset: -2px;
    }
.main {
    align-items: center;
    display: flex;
}
.select {
    align-items: stretch;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    padding: 0.375rem 0.25rem 0.375rem 0.5rem;
    text-align: left;
}
    .child .select {
        padding-left: calc(var(--disclosure-padding) + var(--disclosure-caret) + var(--disclosure-gap));
    }
    .disabled .select {
        cursor: default;
    }
.name {
    color: var(--epicv-text-main);
    font-size: 0.85rem;
    line-height: 1.1rem;
}
.properties {
    color: var(--epicv-text-minor);
    font-size: 0.7rem;
    line-height: 0.9rem;
}
    .properties wa-icon {
        opacity: 0.75;
    }
    .properties .separator {
        position: relative;
        top: -1px;
    }
/* A low second row on a member with children, which shows or hides them without opening the member. */
.disclosure {
    align-items: center;
    color: var(--epicv-text-minor);
    display: flex;
    font-size: 0.7rem;
    gap: var(--disclosure-gap);
    justify-content: flex-start;
    line-height: 1rem;
    margin-top: -0.125rem;
    padding: 0 0.5rem 0.375rem var(--disclosure-padding);
    text-align: left;
}
    .disclosure app-icon {
        flex: 0 0 var(--disclosure-caret);
    }
    .disclosure:hover {
        color: var(--epicv-text-main);
    }
.spinner {
    display: flex;
    flex: 0 0 1.5rem;
    font-size: 1rem;
    justify-content: center;
}
.close-button {
    flex: 0 0 1.5rem;
    visibility: hidden;
}
    .close-button::part(base),
    .retry-button::part(base) {
        font-size: 0.75rem;
        height: 1.5rem;
        padding: 0;
        width: 1.5rem;
    }
/* The retry control of a failed row stays in view, since it is what the row offers. */
.retry-button {
    flex: 0 0 1.5rem;
}
    .retry-button::part(base) {
        color: var(--epicv-error);
        font-size: 1rem;
    }
/* A failed row keeps its name and shows the reason, its secondary line, in the error colour. */
.failed .properties {
    color: var(--epicv-error);
}
    [data-component="navigator-item"]:hover .close-button,
    [data-component="navigator-item"]:focus-within .close-button {
        visibility: visible;
    }
.error {
    color: var(--epicv-error);
}
</style>
