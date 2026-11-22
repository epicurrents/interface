<template>
    <div data-component="radiology-interface"
        :id="`epicurrents-radiology-interface-${$store.state.APP.id}`"
    >
        <div class="viewer">
            <iframe v-if="viewerUrl && !failed" :key="frameKey"
                allow="fullscreen"
                ref="frame"
                referrerpolicy="no-referrer"
                :src="viewerUrl"
                :title="viewerTitle"
                @load="frameLoaded"
            ></iframe>
            <div v-if="viewerUrl && loading" class="loading">
                <wa-spinner class="inline"></wa-spinner>
                {{ $t('Loading the viewer') }}
            </div>
            <div v-else-if="failed" class="error" role="alert">
                <div class="message">
                    <app-icon class="inline" name="triangle-exclamation"></app-icon>
                    {{ $t('The viewer page could not be shown.') }}
                </div>
                <div class="actions">
                    <wa-button appearance="plain" variant="brand" @click="retry">
                        {{ $t('Try again') }}
                    </wa-button>
                    <wa-button appearance="plain" @click="goBack">
                        {{ $t('Back') }}
                    </wa-button>
                </div>
            </div>
            <div v-else-if="!viewerUrl" class="empty">
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
 * to another view and back. Each study shown gets a frame of its own, so one radiology viewer runs at a time and a
 * frame's history never holds another study's page. The frame is dropped, and the view left empty, once the active
 * dataset no longer holds the study: when another dataset becomes active, or the study is removed or destroyed.
 *
 * Only an address the radiology module allows is framed: an `http:` or `https:` page of the application's own origin
 * or of an origin the host named (`viewerUrl.ts`). The frame carries no `sandbox` attribute, since the page is
 * application code of an allowed origin that needs scripts and its own origin, which a sandbox granting both does not
 * restrict.
 *
 * A loading state covers the frame until its page has loaded. A page of the application's own origin that then turns
 * out to be blank or unreadable is replaced by a message with a retry, which frames the page anew, and the way back.
 *
 * The framed page may ask to go back by posting `{ type: 'epicurrents:radiology:return' }` to this window. The request
 * is honoured only from the frame's own window and the origin of the page it was pointed at, while this view is the
 * one shown and the study is still the one open, and takes the nearest step back from the study: to the resource it
 * is attached to, or to the dataset when it has none.
 */
import { defineComponent, markRaw, ref, Ref } from "vue"
import { T } from "#i18n"
import { Log } from "scoped-event-log"
import { useStore } from "vuex"
import type RadiologyResource from "#app/modules/rad/RadiologyResource"
import { RADIOLOGY_MODALITY } from "#app/modules/rad/RadiologyResource"
import { resolveViewerUrl } from "#app/modules/rad/viewerUrl"
import { activeStudy, datasetHolds, isReturnRequest, RADIOLOGY_VIEW, stepBack } from "#app/modules/rad/wayBack"

export default defineComponent({
    name: "RadiologyInterface",
    setup () {
        const ID = 'RadiologyInterface-' + useStore().state.APP.runningId++
        /** How many times the page of the study shown has been framed anew after a failure. */
        const attempt = ref(0)
        /** Whether the framed page loaded blank or unreadable. */
        const failed = ref(false)
        const frame = ref<HTMLIFrameElement>() as Ref<HTMLIFrameElement | undefined>
        /** Whether the frame is still loading its page. */
        const loading = ref(false)
        /** The study the frame shows, which the way back leaves. */
        const study = null as RadiologyResource | null
        /** Id of the study the frame shows. */
        const studyId = ref('')
        // Unsubscribe from store mutations.
        const unsubscribe = null as null | (() => void)
        const viewerTitle = ref('')
        /** The resolved, allowed address the frame is pointed at. */
        const viewerUrl = ref('')
        return {
            ID,
            attempt,
            failed,
            frame,
            loading,
            study,
            studyId,
            unsubscribe,
            viewerTitle,
            viewerUrl,
        }
    },
    computed: {
        footer () {
            return markRaw(this.$store.getters.getResourceFooter(RADIOLOGY_MODALITY))
        },
        /** Identifies the frame, so another study, another address or a retry gets a frame of its own. */
        frameKey (): string {
            return `${this.studyId}|${this.viewerUrl}|${this.attempt}`
        },
        viewName (): string {
            return this.$store.state.APP.view?.name ?? ''
        },
    },
    watch: {
        viewName (value: string) {
            // The frame may have been left holding a study while the view was hidden.
            if (value === RADIOLOGY_VIEW) {
                this.checkActiveResource()
            }
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
         * Frame the active radiology resource's page. With no radiology resource active the frame is left as it is
         * while the active dataset still holds its study, since this view is hidden then and the page is kept for the
         * user's return; a study the dataset no longer holds is dropped with its frame.
         */
        checkActiveResource () {
            const state = this.$store.state
            const study = activeStudy(state)
            if (!study) {
                if (this.viewerUrl && !datasetHolds(state, this.study)) {
                    this.clearStudy()
                }
                return
            }
            const page = resolveViewerUrl(study.viewerUrl)
            if (!page) {
                Log.error(`The viewer address of study '${study.name}' may not be framed.`, this.$options.name || '')
                this.clearStudy()
                return
            }
            this.study = study
            this.viewerTitle = study.name
            if (study.id === this.studyId && page.href === this.viewerUrl) {
                return
            }
            this.attempt = 0
            this.failed = false
            this.loading = true
            this.studyId = study.id
            this.viewerUrl = page.href
        },
        /** Drop the study and its frame, leaving the view empty. */
        clearStudy () {
            this.attempt = 0
            this.failed = false
            this.loading = false
            this.study = null
            this.studyId = ''
            this.viewerTitle = ''
            this.viewerUrl = ''
        },
        /**
         * End the loading state once the frame has loaded a page, and check a page of the application's own origin:
         * one that is blank, or cannot be read because the frame ended up somewhere else, was not shown.
         * @param event - The load event of a frame.
         */
        frameLoaded (event: Event) {
            const frame = event.target as HTMLIFrameElement
            if (this.frame && frame !== this.frame) {
                // A frame that has been replaced.
                return
            }
            this.loading = false
            if (!this.viewerUrl || new URL(this.viewerUrl).origin !== window.location.origin) {
                return
            }
            let address = ''
            try {
                address = frame.contentWindow?.location.href ?? ''
            } catch {
                // The frame holds a page of another origin, such as the browser's own error page.
            }
            if (!address || address === 'about:blank') {
                this.failed = true
            }
        },
        /** Take the way back from the study whose page could not be shown. */
        goBack () {
            const study = this.study
            this.clearStudy()
            stepBack(this.$store, study)
        },
        /**
         * Answer a framed page's request to go back.
         * @param event - A message posted to this window.
         */
        handleMessage (event: MessageEvent) {
            if (!isReturnRequest(event, this.frame?.contentWindow, this.$store.state, this.study)) {
                return
            }
            stepBack(this.$store, this.study)
        },
        /** Frame the page of the study anew. */
        retry () {
            this.attempt++
            this.failed = false
            this.loading = true
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
        // Core changes the dataset and its resources without a store mutation as well.
        this.$store.state.addEventListener(['remove-resource', 'set-active-dataset', 'set-active-resource'], () => {
            this.checkActiveResource()
        }, this.ID)
        window.addEventListener('message', this.handleMessage)
        this.$store.dispatch('display-viewer')
        this.checkActiveResource()
    },
    beforeUnmount () {
        window.removeEventListener('message', this.handleMessage)
        this.$store.state.removeAllEventListeners(this.ID)
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
    position: relative;
    /* Under the frame while its page loads, so a study opens on the view's background rather than a blank one. */
    background-color: var(--epicv-background);
}
    .viewer iframe {
        display: block;
        width: 100%;
        height: 100%;
        border: none;
    }
/* Over the frame until its page has loaded. */
.loading {
    position: absolute;
    inset: 0;
    padding: 2rem;
    text-align: center;
    color: var(--epicv-text-faint);
    background-color: var(--epicv-background);
}
.empty,
.error {
    padding: 2rem;
    text-align: center;
    color: var(--epicv-text-faint);
}
    .error .actions {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        margin-top: 1rem;
    }
.footer {
    position: relative;
    flex-basis: calc(1.5rem + 1px);
}
</style>
