<template>
    <div data-component="native-media-viewer">
        <div v-if="failed" class="failed">
            <app-icon class="inline" name="triangle-exclamation"></app-icon>
            {{ $t('The file could not be opened.') }}
        </div>
        <video v-else-if="RESOURCE.modality === 'video'"
            class="media"
            controls
            preload="metadata"
            :src="RESOURCE.url"
            @error="handleError"
        ></video>
        <audio v-else-if="RESOURCE.modality === 'audio'"
            class="media audio"
            controls
            preload="metadata"
            :src="RESOURCE.url"
            @error="handleError"
        ></audio>
        <img v-else-if="RESOURCE.modality === 'image'"
            :alt="RESOURCE.name"
            class="media"
            :src="RESOURCE.url"
            @error="handleError"
        />
    </div>
</template>

<script lang="ts">
/**
 * Renders the active native media resource with the browser's own element for its modality. The media interface
 * mounts one viewer per resource and unmounts it when the resource is no longer active, which stops playback.
 */
import { defineComponent, PropType, ref } from 'vue'
import { T } from '#i18n'
import { useStore } from 'vuex'
import type NativeMediaResource from '../NativeMediaResource'

export default defineComponent({
    name: 'NativeMediaViewer',
    props: {
        viewerSize: {
            type: Array as PropType<number[]>,
            required: true,
        },
    },
    setup () {
        const store = useStore()
        // Held from mount: the active resource changes before this component is unmounted.
        const RESOURCE = store.getters.getActiveResource() as NativeMediaResource
        const failed = ref(false)
        return {
            RESOURCE,
            failed,
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
        handleError () {
            this.failed = true
        },
    },
    beforeMount () {
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
})
</script>

<style scoped>
[data-component="native-media-viewer"] {
    align-items: center;
    box-sizing: border-box;
    display: flex;
    height: 100%;
    justify-content: center;
    padding: 1rem;
    width: 100%;
}
.media {
    display: block;
    max-height: 100%;
    max-width: 100%;
    object-fit: contain;
}
.audio {
    width: min(40rem, 100%);
}
.failed {
    font-size: 1.25rem;
}
    .failed app-icon {
        color: var(--epicv-warning);
    }
</style>
