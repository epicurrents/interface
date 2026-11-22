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
 * dataset; the step before the study opens the resource it is attached to. The trail is emptied once the active
 * dataset no longer holds the study it leads to.
 */
import { defineComponent, ref } from 'vue'
import type { DataResource } from '@epicurrents/core/types'
import AppFooter from '#app/footers/AppFooter.vue'
import { T } from '#i18n'
import { useStore } from 'vuex'
import type RadiologyResource from '../RadiologyResource'
import { activeStudy, datasetHolds, parentOf, showDataset } from '../wayBack'

export default defineComponent({
    name: 'RadiologyFooter',
    components: {
        AppFooter,
    },
    setup () {
        const ID = 'RadiologyFooter-' + useStore().state.APP.runningId++
        const datasetName = ref('')
        const parent = null as DataResource | null
        const parentName = ref('')
        /** The study the trail leads to. */
        const study = null as RadiologyResource | null
        const studyName = ref('')
        const unsubscribe = null as null | (() => void)
        return {
            ID,
            datasetName,
            parent,
            parentName,
            study,
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
            const state = this.$store.state
            const study = activeStudy(state)
            if (!study) {
                // Nothing of this view is open: the trail stays as it was, behind the view the user went on to,
                // for as long as the active dataset holds the study it leads to.
                if (this.study && !datasetHolds(state, this.study)) {
                    this.clearTrail()
                }
                return
            }
            this.study = study
            this.datasetName = state.APP.activeDataset?.name || ''
            this.parent = parentOf(state, study)
            this.parentName = this.parent?.name || ''
            this.studyName = study.name
        },
        /** Empty the trail of a study the active dataset no longer holds. */
        clearTrail () {
            this.datasetName = ''
            this.parent = null
            this.parentName = ''
            this.study = null
            this.studyName = ''
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
        // Core changes the dataset and its resources without a store mutation as well.
        this.$store.state.addEventListener(['remove-resource', 'set-active-dataset', 'set-active-resource'], () => {
            this.checkActiveResource()
        }, this.ID)
    },
    beforeUnmount () {
        this.$store.state.removeAllEventListeners(this.ID)
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
