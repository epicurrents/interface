<template>
    <navigator-item :resource="resource"></navigator-item>
    <div v-if="children.length" class="children">
        <navigator-item v-for="child in children" :key="`navigator-item-${child.id}`"
            :parent="resource"
            :resource="child"
        ></navigator-item>
    </div>
</template>

<script lang="ts">
/**
 * A dataset member in the navigator, with the resources listed under it as its children.
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
        return {
            ID,
            children,
        }
    },
    methods: {
        childrenUpdated () {
            this.children = [...this.resource.childResources]
        },
    },
    watch: {
        resource (value: DataResource, previous: DataResource) {
            previous.unsubscribeAll(this.ID)
            value.onPropertyChange('childResources', this.childrenUpdated, this.ID)
            this.childrenUpdated()
        },
    },
    beforeMount () {
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    mounted () {
        this.resource.onPropertyChange('childResources', this.childrenUpdated, this.ID)
        this.childrenUpdated()
    },
    beforeUnmount () {
        this.resource.unsubscribeAll(this.ID)
    },
})
</script>

<style scoped>
/* Spaced as the navigator spaces its members, and kept at its height in the scroll as they are. */
.children {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 0.25rem;
    padding-left: 1rem;
}
</style>
