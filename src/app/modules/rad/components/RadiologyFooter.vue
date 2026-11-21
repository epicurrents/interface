<template>
    <AppFooter>
        <div class="breadcrumbs">
            <wa-breadcrumb>
                <wa-breadcrumb-item v-if="datasetName"
                    :title="$t('Show the dataset')"
                    @click="showDataset"
                >
                    {{ datasetName }}
                </wa-breadcrumb-item>
                <wa-breadcrumb-item v-if="parentName"
                    :title="$t('Open the resource this study is attached to')"
                    @click="showParent"
                >
                    {{ parentName }}
                </wa-breadcrumb-item>
                <wa-breadcrumb-item v-if="studyName" class="no-link">
                    {{ studyName }}
                </wa-breadcrumb-item>
            </wa-breadcrumb>
        </div>
    </AppFooter>
</template>

<script lang="ts">
/**
 * Footer of the radiology view: the active dataset, the resource the study is attached to when it has one, and the
 * study open in the frame, as a trail. The radiology view hides the dataset navigator to give the framed viewer the
 * width, so the dataset step closes the study and returns to the default view, which lists every member of the
 * dataset; the step before the study opens the resource it is attached to.
 */
import { defineComponent, ref } from 'vue'
import type { DataResource } from '@epicurrents/core/types'
import AppFooter from '#app/footers/AppFooter.vue'
import { T } from '#i18n'
import type RadiologyResource from '../RadiologyResource'
import { RADIOLOGY_MODALITY } from '../RadiologyResource'
import { parentOf, showDataset } from '../wayBack'

export default defineComponent({
    name: 'RadiologyFooter',
    components: {
        AppFooter,
    },
    setup () {
        const datasetName = ref('')
        const parent = null as DataResource | null
        const parentName = ref('')
        const studyName = ref('')
        const unsubscribe = null as null | (() => void)
        return {
            datasetName,
            parent,
            parentName,
            studyName,
            unsubscribe,
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
        checkActiveResource () {
            const dataset = this.$store.state.APP.activeDataset
            const study = (dataset?.activeResources as DataResource[] | undefined)?.find(
                r => r.modality === RADIOLOGY_MODALITY
            ) as RadiologyResource | undefined
            if (!study) {
                // Nothing of this view is open: the trail stays as it was, behind the view the user went on to.
                return
            }
            this.datasetName = dataset?.name || ''
            this.parent = parentOf(this.$store.state, study)
            this.parentName = this.parent?.name || ''
            this.studyName = study.name
        },
        showDataset () {
            showDataset(this.$store)
        },
        showParent () {
            if (this.parent) {
                this.$store.dispatch('set-active-child-resource', { child: null, parent: this.parent })
            }
        },
    },
    beforeMount () {
        this.$store.dispatch('add-component-styles', { component: this.$options.name, styles: this.$options.__scopeId })
        this.checkActiveResource()
    },
    mounted () {
        this.unsubscribe = this.$store.subscribe(mutation => {
            if (mutation.type === 'set-active-resource' || mutation.type === 'set-active-dataset') {
                this.$nextTick(() => {
                    this.checkActiveResource()
                })
            }
        })
    },
    beforeUnmount () {
        this.unsubscribe?.()
    },
})
</script>

<style scoped>
.breadcrumbs {
    padding: 0 0.5rem;
}
    .breadcrumbs wa-breadcrumb-item::part(label) {
        font-size: 0.8rem;
        height: 1.5rem;
        line-height: 1.5rem;
    }
    .breadcrumbs wa-breadcrumb-item.no-link::part(label) {
        cursor: default;
    }
</style>
