<template>
    <div data-component="radiology-interface"
        :id="`epicurrents-radiology-interface-${$store.state.APP.id}`"
    >
        <div class="viewer">
            <iframe v-if="viewerUrl"
                allow="fullscreen"
                ref="frame"
                :src="viewerUrl"
                :title="viewerTitle"
            ></iframe>
            <div v-else class="empty">
                {{ $t('No radiology study is open.') }}
            </div>
        </div>
        <component v-if="$store.state.APP.uiComponentVisible.footer && !$store.state.INTERFACE.app.isExpanded"
            class="footer"
            :is="footer"
        ></component>
    </div>
</template>

<script lang="ts">
/**
 * Frames the viewer page of the active radiology resource.
 *
 * The application keeps this view mounted and hidden while another view is active, so the frame is created when a
 * radiology resource is first activated and keeps its page, with whatever state the user left it in, across a switch
 * to another view and back. Activating another radiology resource points the same frame at that resource's page, so
 * one radiology viewer runs at a time.
 *
 * The framed page may ask to go back by posting `{ type: 'epicurrents:radiology:return' }` to this window. The request
 * is honoured only from the frame's own window and from this document's origin, and takes the nearest step back from
 * the study: to the resource it is attached to, or to the dataset when it has none.
 */
import { defineComponent, markRaw, ref, Ref } from "vue"
import { T } from "#i18n"
import type { DataResource } from "@epicurrents/core/types"
import RadiologyResource, { RADIOLOGY_MODALITY, RADIOLOGY_RETURN_MESSAGE } from "#app/modules/rad/RadiologyResource"
import { stepBack } from "#app/modules/rad/wayBack"

export default defineComponent({
    name: "RadiologyInterface",
    setup () {
        const frame = ref<HTMLIFrameElement>() as Ref<HTMLIFrameElement | undefined>
        /** The study the frame shows, which the way back leaves. */
        const study = null as RadiologyResource | null
        // Unsubscribe from store mutations.
        const unsubscribe = null as null | (() => void)
        const viewerTitle = ref('')
        const viewerUrl = ref('')
        return {
            frame,
            study,
            unsubscribe,
            viewerTitle,
            viewerUrl,
        }
    },
    computed: {
        footer () {
            return markRaw(this.$store.getters.getResourceFooter(RADIOLOGY_MODALITY))
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
        /**
         * Point the frame at the active radiology resource's page. With no radiology resource active the frame is left
         * as it is, since this view is hidden then and the page is kept for the user's return.
         */
        checkActiveResource () {
            const active = (this.$store.state.APP.activeDataset?.activeResources ?? []) as DataResource[]
            const study = active.find(r => r.modality === RADIOLOGY_MODALITY) as RadiologyResource | undefined
            if (!study?.viewerUrl) {
                return
            }
            this.study = study
            if (study.viewerUrl === this.viewerUrl) {
                return
            }
            this.viewerTitle = study.name
            this.viewerUrl = study.viewerUrl
        },
        /**
         * Answer a framed page's request to go back.
         * @param event - A message posted to this window.
         */
        handleMessage (event: MessageEvent) {
            if (event.origin !== window.location.origin || event.source !== this.frame?.contentWindow) {
                return
            }
            if ((event.data as { type?: string } | null)?.type !== RADIOLOGY_RETURN_MESSAGE) {
                return
            }
            stepBack(this.$store, this.study)
        },
    },
    beforeMount () {
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    mounted () {
        this.unsubscribe = this.$store.subscribe(mutation => {
            if (mutation.type === 'set-active-resource' || mutation.type === 'set-active-dataset') {
                this.$nextTick(() => {
                    this.checkActiveResource()
                })
            }
        })
        window.addEventListener('message', this.handleMessage)
        this.$store.dispatch('display-viewer')
        this.checkActiveResource()
    },
    beforeUnmount () {
        window.removeEventListener('message', this.handleMessage)
        if (this.unsubscribe) {
            this.unsubscribe()
        }
    },
})
</script>

<style scoped>
[data-component="radiology-interface"] {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
}
.viewer {
    flex: 1;
    min-height: 0;
    /* Under the frame while its page loads, so a study opens on the view's background rather than a blank one. */
    background-color: var(--epicv-background);
}
    .viewer iframe {
        display: block;
        width: 100%;
        height: 100%;
        border: none;
    }
.empty {
    padding: 2rem;
    text-align: center;
    color: var(--epicv-text-faint);
}
.footer {
    position: relative;
    flex-basis: calc(1.5rem + 1px);
}
</style>
