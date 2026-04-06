<template>
    <wa-button data-component="navigator-item"
        appearance="outlined"
        :class="{
            'active': resource.isActive,
            'disabled': !isReady
        }"
        variant="brand"
        @click="resourceClicked"
    >
        <div v-if="isReady" :class="['name', 'epicv-oneliner']">{{ parseResourceName(resource.name) }}</div>
        <div v-else-if="resource.state === 'error'" :class="['name', 'epicv-oneliner']">
            {{ $t('Error loading resource') }}
        </div>
        <div v-else :class="['name', 'epicv-oneliner']">{{ $t('Loading resource') }}</div>
        <div :class="['properties', 'epicv-oneliner']">
            <template v-for="(props, idx) of resourceProps" :key="`resource-property-${idx}`">
                <span class="separator" v-if="idx"> | </span>
                <app-icon v-if="props.icon"
                    :id="`nav-item-${idx}-icon`"
                    :name="props.icon"
                ></app-icon>
                <wa-tooltip v-if="props.icon" :for="`nav-item-${idx}-icon`">
                    {{ props.tooltip || '' }}
                </wa-tooltip>
                {{ props.text }}
            </template>
        <wa-button
            appearance="plain"
            class="close-button"
            :id="`close-button-${resource.id}`"
            @click.stop="closeResource"
        >
            <app-icon :name="closeButtonIcon"></app-icon>
        </wa-button>
        <wa-tooltip
            :for="`close-button-${resource.id}`"
            position="down"
        >
            {{ $t('Close resource') }}
        </wa-tooltip>
        </div>
        <div v-if="!isReady" class="spinner" slot="suffix">
            <wa-spinner v-if="resource.state !== 'error'"></wa-spinner>
            <app-icon v-else class="error" name="octagon-exclamation"></app-icon>
        </div>
    </wa-button>
</template>

<script lang="ts">
/**
 * A single item in for the sidebar.
 */
import { defineComponent, PropType, ref } from "vue"
import { T } from "#i18n"
import type { DataResource } from "@epicurrents/core/types"
import { useStore } from "vuex"
import { secondsToTimeString, timePartsToShortString } from "@epicurrents/core/util"

// Child components

export default defineComponent({
    name: 'NavigatorItem',
    props: {
        resource: {
            type: Object as PropType<DataResource>,
            required: true,
        }
    },
    setup () {
        const ID = 'NavigatorItem-' + useStore().state.APP.runningId++
        const isReady = ref(false)
        const resourceProps = ref([] as { [key: string]: string }[])
        return {
            ID,
            isReady,
            resourceProps,
        }
    },
    computed: {
        closeButtonIcon (): string {
            // This can return a different icon, if the resource is set up to be destroyed after closing.
            return 'xmark'
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
            if (!this.resource.isReady) {
                return
            }
            this.$store.dispatch('set-active-resource', this.resource)
        },
        resourceUpdated () {
            const props = [] as { [key: string]: string }[]
            for (const [name, value] of this.resource.getMainProperties()) {
                if (value !== null) {
                    const strParams = {} as { [key: string]: string }
                    if (name === 'duration') {
                        const timeParts = secondsToTimeString(value, true) as number[]
                        const timeShort = timePartsToShortString(timeParts)
                        strParams.icon = 'clock'
                        strParams.text = timeShort
                        strParams.tooltip = this.$t('Duration: {t}', { t: secondsToTimeString(value) })
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
                    }
                } else if (name === 'pages') {
                    props.push({ text: this.$t('Not loaded yet') })
                }
            }
            this.isReady = this.resource.isReady
            this.resourceProps = props
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
        this.resource.onPropertyChange(
            ['dependenciesReady', 'isActive', 'isReady', 'state'],
            this.resourceUpdated,
            this.ID
        )
        // Check initial state.
        this.resourceUpdated()
        this.$nextTick(() => {
            this.$emit('loaded')
        })
    },
    beforeUnmount () {
        // Remove property update handlers
        this.resource.unsubscribeAll(this.ID)
    }
})
</script>

<style scoped>
[data-component="navigator-item"] {
    height: 3rem;
    overflow: hidden;
    width: 100%;
}
    [data-component="navigator-item"]::part(base) {
        justify-content: flex-start;
        height: 3rem;
        padding: 0 0.5rem;
        position: relative;
    }
    [data-component="navigator-item"]::part(start) {
        flex: 0;
    }
    [data-component="navigator-item"]::part(label) {
        flex: 1;
        text-align: left;
        padding: 0;
    }
    [data-component="navigator-item"]::part(end) {
        flex: 0 0 1.5rem;
    }
    [data-component="navigator-item"].active::part(base) {
        border-color: var(--epicv-border-active);
        box-shadow: inset 0 0 0.25rem var(--epicv-border-active);
    }
    [data-component="navigator-item"]:not(.active):not(:hover) {
        opacity: 0.8;
    }
    [data-component="navigator-item"].disabled {
        opacity: 0.5;
        cursor: default;
    }
    .close-button {
        display: none;
        position: absolute;
        right: 0.5rem;
        top: 0.25rem;
    }
        .close-button::part(base) {
            font-size: 0.75rem;
            height: 0.5rem;
            padding: 0;
            width: 0.5rem;
        }
        [data-component="navigator-item"].active:hover .close-button {
            display: block;
        }
    .name {
        color: var(--epicv-text-main);
        font-size: 0.9em;
        height: 1.25rem;
        line-height: 1.5rem;
    }
    .properties {
        height: 1rem;
        line-height: 1rem;
        font-size: 0.7em;
        color: var(--epicv-text-minor);
    }
        .properties wa-icon {
            opacity: 0.75;
            position: relative;
            top: 1px;
        }
        .properties .separator {
            position: relative;
            top: -1px;
        }
    .spinner {
        display: flex;
        justify-content: center;
        font-size: 1.25rem;
    }
    .error {
        color: var(--epicv-error);
    }
</style>
