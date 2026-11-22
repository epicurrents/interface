<template>
    <navigator-item
        :child-count="children.length"
        :children-id="childrenId"
        :expanded="disclosure.isOpen"
        :resource="resource"
        @selected="openChildren"
        @toggle-children="toggleChildren"
    ></navigator-item>
    <div v-if="disclosure.isOpen && children.length"
        class="children"
        role="group"
        :aria-label="$t('Resources nested under {name}', { name: resource.name })"
        :id="childrenId"
    >
        <navigator-item v-for="child in children" :key="`navigator-item-${child.id}`"
            :parent="resource"
            :resource="child"
        ></navigator-item>
    </div>
</template>

<script lang="ts">
/**
 * A dataset member in the navigator, with the resources listed under it as its children. The children are shown
 * when the member is opened and while it is active, which it also is while one of them is shown, and hidden when it
 * stops being active; the disclosure row shows or hides them in between. The navigator keeps that state, so it
 * outlives the entry while the member is scrolled out of view.
 */
import { defineComponent, PropType, ref } from "vue"
import { T } from "#i18n"
import type { DataResource } from "@epicurrents/core/types"
import type { EntryDisclosure } from "./rows"
import { useStore } from "vuex"
// Child components
import NavigatorItem from './NavigatorItem.vue'

export default defineComponent({
    name: 'NavigatorEntry',
    components: {
        NavigatorItem,
    },
    props: {
        /** Whether the member's children are shown, kept by the navigator for as long as the dataset is open. */
        disclosure: {
            type: Object as PropType<EntryDisclosure>,
            required: true,
        },
        resource: {
            type: Object as PropType<DataResource>,
            required: true,
        },
    },
    setup () {
        const ID = 'NavigatorEntry-' + useStore().state.APP.runningId++
        const children = ref([] as DataResource[])
        return {
            ID,
            children,
        }
    },
    computed: {
        /** Id of the element holding the children, which the member's disclosure row names as what it controls. */
        childrenId (): string {
            return `navigator-children-${this.resource.id}`
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
        entryUpdated () {
            this.children = [...this.resource.childResources]
            if (this.resource.isActive !== this.disclosure.wasActive) {
                this.disclosure.isOpen = this.resource.isActive
                this.disclosure.wasActive = this.resource.isActive
            }
        },
        openChildren () {
            this.disclosure.isOpen = true
        },
        subscribe (resource: DataResource) {
            resource.onPropertyChange(['childResources', 'isActive'], this.entryUpdated, this.ID)
        },
        toggleChildren () {
            this.disclosure.isOpen = !this.disclosure.isOpen
        },
    },
    watch: {
        resource (value: DataResource, previous: DataResource) {
            previous.unsubscribeAll(this.ID)
            this.subscribe(value)
            this.entryUpdated()
        },
    },
    beforeMount () {
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    mounted () {
        this.subscribe(this.resource)
        this.entryUpdated()
    },
    beforeUnmount () {
        this.resource.unsubscribeAll(this.ID)
    },
})
</script>

<style scoped>
/* Kept at its height in the navigator's scroll, as the members are. */
.children {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
}
</style>
