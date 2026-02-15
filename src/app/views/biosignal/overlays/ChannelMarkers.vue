<template>
    <div data-component="channel-markers" ref="component">
        <template v-for="(chanMarks, idx) of markers" :key="`channel-${idx}-markers`">
            <svg v-for="(marker, idy) of chanMarks" :key="`channel-${idx}-marker-${idy}`"
                class="marker"
                height="40"
                overflow="visible"
                :style="marker.style"
                :viewBox="`0 0 ${SETTINGS.markers[marker.isActive ? 'active' : 'inactive'].style === 'line' ? 10 : 24} 40`"
                @pointerdown="handleMarkerPointerdown($event, marker)"
            >
                <text v-if="marker.dragging" x="50%" y="16" text-anchor="middle">{{ marker.label }}</text>
                <circle v-if="SETTINGS.markers[marker.isActive ? 'active' : 'inactive'].style === 'circle'"
                    cx="12" cy="28" r="8"
                    :stroke="settingsColorToRgba(SETTINGS.markers[marker.isActive ? 'active' : 'inactive'].color)"
                    :stroke-width="SETTINGS.markers[marker.isActive ? 'active' : 'inactive'].width"
                    fill="none"
                />
                <line v-if="SETTINGS.markers[marker.isActive ? 'active' : 'inactive'].style === 'line'"
                    x1="5" y1="20" x2="5" y2="36"
                    shape-rendering="crispEdges"
                    :stroke="settingsColorToRgba(SETTINGS.markers[marker.isActive ? 'active' : 'inactive'].color)"
                    :stroke-width="SETTINGS.markers[marker.isActive ? 'active' : 'inactive'].width"
                />
            </svg>
        </template>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType, reactive, ref } from "vue"
import { T } from "#i18n"
import { BiosignalChannelMarker } from "@epicurrents/core/types"
import { settingsColorToRgba } from "@epicurrents/core/util"
import { shouldDisplayChannel } from "@epicurrents/core/util"
import type { OverlayPointerEventMeta, PointerEventOverlay } from "#app/overlays/PointerEventOverlay.vue"
import { useStore } from "vuex"
import { useEegContext } from "#app/modules/eeg"

type StyledChannelMarker = BiosignalChannelMarker & {
    dragging: boolean
    style: string
    text?: string
    setPosition: (position: number) => void,
    setValue: (value: number) => void,
}

export default defineComponent({
    name: 'ChannelMarkers',
    props: {
        secPerPage: {
            type: Number,
            required: true,
        },
        overlay: {
            type: Object as PropType<PointerEventOverlay>,
            required: true,
        },
        sensitivityUnits: {
            type: Number,
            default: 1,
        },
    },
    setup () {
        const store = useStore()
        const dragging = ref(false)
        const markers = reactive([] as StyledChannelMarker[][])
        // Template refs
        // Unsubscribe from store mutations
        const unsubscribe = ref(null as (() => void) | null)
        return {
            dragging,
            markers,
            // Template refs
            // Imported methods
            settingsColorToRgba,
            ...useEegContext(store),
            // Unsubscribers
            unsubscribe,
        }
    },
    watch: {
        msPerPage () {
            this.drawMarkers()
        },
    },
    computed: {
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
        drawMarkers () {
            const offsetW = this.SETTINGS.markers.active.style === 'line' ? 5 : 12
            // Remove all previous markers to enforce update
            this.markers.splice(0)
            let c = 0
            for (const chan of this.RESOURCE.channels.filter(c => shouldDisplayChannel(c, true, this.SETTINGS))) {
                const cIdx = c
                // Channel index must be defined before any continue instructions
                c++
                // Create a new marker group for each channel
                const chanMarkers = [] as StyledChannelMarker[]
                const displayPol = chan.displayPolarity || this.SETTINGS.displayPolarity
                let i = 0
                for (const marker of chan.markers) {
                    if (marker.position === null || marker.value === null) {
                        i++
                        continue
                    }
                    const markerX = (marker.position/this.secPerPage)*100
                    if (markerX > 100) {
                        // Don't draw out-of-sight markers
                        continue
                    }
                    // TODO: Figure out the reason for the 0.33 offset.
                    const sensitivity = (this.sensitivityUnits - 0.33)*(chan.sensitivity || this.RESOURCE.sensitivity)
                    const markerY = ((chan.offset?.baseline || 0) + (displayPol*marker.value/sensitivity))*100
                    const idx = i
                    // We need to be able to modify one index value
                    let j = idx
                    // Pass on changes to the parent object
                    const setPosition = (position: number) => {
                        marker.position = position
                        chanMarkers[j].position = position
                        chanMarkers[j].label = marker.label // Update reactive label if needed.
                        // If the channel has only one marker, no need to continue
                        if (chan.markers.length === 1) {
                            return
                        }
                        // Check if the index of this marker should be changed.
                        const prevPos = chan.markers[j - 1]?.position ?? null
                        const nextPos = chan.markers[j + 1]?.position ?? null
                        if (j && prevPos !== null && prevPos > position) {
                            // Marker was dragged over the one before it
                            ;[chan.markers[j - 1], chan.markers[j]] = [chan.markers[j], chan.markers[j - 1]]
                            ;[chanMarkers[j - 1], chanMarkers[j]] = [chanMarkers[j], chanMarkers[j - 1]]
                            this.$emit('rearranged', cIdx, j - 1, j)
                            // Update active states after the parent element has sorted them out
                            chanMarkers[j - 1].isActive = chan.markers[j - 1].isActive
                            chanMarkers[j].isActive = chan.markers[j].isActive
                            // Finally, update the dynamic index
                            j -= 1
                        } else if (nextPos !== null && nextPos < position) {
                            // Marker was dragged over the one after it
                            ;[chan.markers[j], chan.markers[j + 1]] = [chan.markers[j + 1], chan.markers[j]]
                            ;[chanMarkers[j], chanMarkers[j + 1]] = [chanMarkers[j + 1], chanMarkers[j]]
                            this.$emit('rearranged', cIdx, j, j + 1)
                            chanMarkers[j].isActive = chan.markers[j].isActive
                            chanMarkers[j + 1].isActive = chan.markers[j + 1].isActive
                            j += 1
                        }
                        this.$emit('updated', cIdx - 1, j)
                    }
                    const setValue = (value: number) => {
                        marker.value = value
                        this.$emit('updated', cIdx, j)
                    }
                    chanMarkers.push({
                        channel: chan,
                        dragging: false,
                        isActive: marker.isActive,
                        label: marker.label,
                        position: marker.position,
                        style: `left: calc(${markerX}% - ${offsetW}px); bottom: calc(${markerY}% - 12px)`,
                        value: marker.value,
                        idx: j,
                        setPosition: setPosition,
                        setValue: setValue,
                    } as any)
                    i++
                }
                this.markers.push(chanMarkers)
            }
        },
        handleMarkerPointerdown (event: PointerEvent, marker: StyledChannelMarker) {
            this.dragging = true
            marker.dragging = true
            const offsetW = this.SETTINGS.markers.active.style === 'line' ? 5 : 12
            const chanSr = marker.channel.samplingRate
            const displayPol = marker.channel.displayPolarity || this.SETTINGS.displayPolarity
            const sensitivity = this.sensitivityUnits*(marker.channel.sensitivity || this.RESOURCE.sensitivity)
            const pointerMove = (_left: number, _top: number, meta: OverlayPointerEventMeta) => {
                // Prevent dragging out to negative index range
                const latency = Math.max(this.secPerPage*meta.relX, 0)
                // Use zero if the marker is dragged outside index range
                const value = marker.channel.signal?.[Math.round(chanSr*latency)] || 0
                const markerX = (latency/this.secPerPage)*100
                const markerY = ((marker.channel.offset?.baseline || 0) + (displayPol*value/sensitivity))*100
                marker.style = `left: calc(${markerX}% - ${offsetW}px); bottom: calc(${markerY}% - 12px)`
                marker.value = value
                marker.setPosition(latency)
                marker.setValue(value)
            }
            const pointerUp = (_left: number, _top: number, _meta: OverlayPointerEventMeta) => {
                this.dragging = false
                marker.dragging = false
                // Delay updating the markers until the drag event is complete
                this.drawMarkers()
            }
            this.overlay.trackPointer(event, { move: pointerMove, up: pointerUp })
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
        this.RESOURCE.onPropertyChange(['sensitivity', 'timebase', 'timebaseUnit'], () => {
            this.$nextTick(() => {
                this.drawMarkers()
            })
        }, this.ID)
        this.drawMarkers()
    },
    beforeUnmount () {
        // Remove property update handlers
        this.RESOURCE.removeAllEventListeners(this.ID)
    }
})
</script>

<style scoped>
[data-component="channel-markers"] {
    height: 100%;
    position: relative;
    width: 100%;
}
    .marker {
        position: absolute;
        z-index: 2;
        overflow: visible;
        cursor: pointer;
    }
</style>
