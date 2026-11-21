<template>
    <navigator-item
        :child-count="children.length"
        :expanded="isOpen"
        :resource="resource"
        @selected="openChildren"
        @toggle-children="toggleChildren"
    ></navigator-item>
    <div v-if="isOpen && children.length" class="children" role="group">
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
 * stops being active; the disclosure row shows or hides them in between.
 */
import { defineComponent, PropType, ref } from "vue"
import type { DataResource } from "@epicurrents/core/types"
import { useStore } from "vuex"
// Child components
import NavigatorItem from './NavigatorItem.vue'

export default defineComponent({
    name: 'NavigatorEntry',
    components: {
        NavigatorItem,
    },
    props: {
        resource: {
            type: Object as PropType<DataResource>,
            required: true,
        },
    },
    setup () {
        const ID = 'NavigatorEntry-' + useStore().state.APP.runningId++
        const children = ref([] as DataResource[])
        const isOpen = ref(false)
        /** The member's activity when the entry last read it, so only a change of it opens or closes the list. */
        const wasActive = ref(false)
        return {
            ID,
            children,
            isOpen,
            wasActive,
        }
    },
    methods: {
        entryUpdated () {
            this.children = [...this.resource.childResources]
            if (this.resource.isActive !== this.wasActive) {
                this.isOpen = this.resource.isActive
                this.wasActive = this.resource.isActive
            }
        },
        openChildren () {
            this.isOpen = true
        },
        subscribe (resource: DataResource) {
            resource.onPropertyChange(['childResources', 'isActive'], this.entryUpdated, this.ID)
        },
        toggleChildren () {
            this.isOpen = !this.isOpen
        },
    },
    watch: {
        resource (value: DataResource, previous: DataResource) {
            previous.unsubscribeAll(this.ID)
            this.subscribe(value)
            this.isOpen = false
            this.wasActive = false
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
