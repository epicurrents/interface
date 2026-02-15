<template>
    <div data-component="eeg-channel-properties" ref="component">
        <div class="title">
            {{ !channels.length ? channel.label : channels.length === 1 ? channels[0].label : $t('Multiple') }}
        </div>
        <div class="close" :title="$t('Close menu')" @click="close">X</div>
        <div class="header">{{ $t('Display properties') }}</div>
        <div class="property">
            <div class="name">{{ $t('Sensitivity') }}</div>
            <div class="value">
                <wa-select :value="`sensitivity:${sensitivity}`" @change="setSensitivity($event.target.value)">
                    <wa-option value="sensitivity:0">{{ $t('Default') }}</wa-option>
                    <wa-option v-for="(sens, idx) in SETTINGS.sensitivity.uVperCm.availableValues"
                        :key="`ecp-sensitivity-${idx}`"
                        :value="`sensitivity:${sens}`"
                    >
                        {{ sens }}
                        <span slot="end">µV/cm</span>
                    </wa-option>
                </wa-select>
            </div>
        </div>
        <div class="property">
            <div class="name">{{ $t('Polarity') }}</div>
            <div class="value">
                <wa-select :value="`polarity:${polarity}`" @change="setPolarity($event.target.value)">
                    <wa-option value="polarity:0">{{ $t('Default') }}</wa-option>
                    <wa-option value="polarity:-1">{{ $t('Negative') }}</wa-option>
                    <wa-option value="polarity:1">{{ $t('Positive') }}</wa-option>
                </wa-select>
            </div>
        </div>
        <div class="property">
            <div class="name">{{ $t('Scale') }}</div>
            <div class="value">
                <wa-select :value="`scale:${scale}`" @change="setScale($event.target.value)">
                    <template v-for="(scale, idx) in SETTINGS.scale.availableValues">
                        <wa-option v-if="scale"
                            :key="`ecp-scale-${idx}`" :value="`scale:${scale}`"
                        >
                            <span slot="prefix">10^</span>
                            {{ scale }}
                        </wa-option>
                        <wa-option v-else
                            key="ecp-scale-disabled" :value="`scale:${scale}`"
                        >
                            {{ $t('Disabled') }}
                        </wa-option>
                    </template>
                </wa-select>
            </div>
        </div>
        <div class="space"></div>
        <div class="header">{{ $t('Filters') }}</div>
        <div class="property">
            <div class="name">{{ $t('High-pass') }}</div>
            <div class="value">
                <wa-select :value="`highpass:${highpass}`" @change="setHighpassFilter($event.target.value)">
                    <wa-option value="highpass:null">{{ $t('Default') }}</wa-option>
                    <wa-option v-for="(hf, idx) in SETTINGS.filters.highpass.availableValues"
                        :key="`ecp-highpass-${idx}`"
                        :value="`highpass:${hf}`"
                    >
                        {{ hf ? `${hf}` : $t('Disabled') }}
                        <span v-if="hf" slot="end">Hz</span>
                    </wa-option>
                </wa-select>
            </div>
        </div>
        <div class="property">
            <div class="name">{{ $t('Low-pass') }}</div>
            <div class="value">
                <wa-select :value="`lowpass:${lowpass}`" @change="setLowpassFilter($event.target.value)">
                    <wa-option value="lowpass:null">{{ $t('Default') }}</wa-option>
                    <wa-option v-for="(lf, idx) in SETTINGS.filters.lowpass.availableValues"
                        :key="`ecp-lowpass-${idx}`"
                        :value="`lowpass:${lf}`"
                    >
                        {{ lf ? `${lf}` : $t('Disabled') }}
                        <span v-if="lf" slot="end">Hz</span>
                    </wa-option>
                </wa-select>
            </div>
        </div>
        <div class="property">
            <div class="name">{{ $t('Notch') }}</div>
            <div class="value">
                <wa-select :value="`notch:${notch}`" @change="setNotchFilter($event.target.value)">
                    <wa-option value="notch:null">{{ $t('Default') }}</wa-option>
                    <wa-option v-for="(nf, idx) in SETTINGS.filters.notch.availableValues"
                        :key="`ecp-notch-${idx}`"
                        :value="`notch:${nf}`"
                    >
                        {{ nf ? `${nf}` : $t('Disabled') }}
                        <span v-if="nf" slot="end">Hz</span>
                    </wa-option>
                </wa-select>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import {
    defineComponent,
    ref,
    type PropType,
    type Ref,
} from "vue"
import { T } from "#i18n"
import type {
    MontageChannel,
    SourceChannel,
} from "@epicurrents/core/types"
import { settingsColorToRgba } from "@epicurrents/core/util"
import { useStore } from "vuex"
import { useEegContext } from "../../"
import type { PointerEventOverlay } from "#root/src/app/overlays/PointerEventOverlay.vue"

export default defineComponent({
    name: 'EegChannelProperties',
    props: {
        changes: {
            type: Number,
            default: 0,
        },
        channel: {
            type: Object as PropType<MontageChannel>,
            required: true,
        },
        overlay: {
            type: Object as PropType<PointerEventOverlay>,
            required: true,
        },
        viewerHeight: {
            type: Number,
            required: true,
        },
    },
    setup () {
        const channels = ref([] as (MontageChannel | SourceChannel)[])
        // Decouple component properties from actual channel properties
        const highpass = ref(-1 as number | null)
        const lowpass = ref(-1 as number | null)
        const notch = ref(-1 as number | null)
        const polarity = ref(0 as -1 | 0 | 1 | null)
        const scale = ref(0 as number | null)
        const sensitivity = ref(0 as number | null)
        const updating = false
        // DOM
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            channels,
            highpass,
            lowpass,
            notch,
            polarity,
            updating,
            scale,
            sensitivity,
            // DOM
            component,
            // Imported methods
            settingsColorToRgba,
            // Scoped properties
            ...useEegContext(useStore(), 'EegChannelProperties'),
        }
    },
    watch: {
        changes () {
            this.checkChannels()
            this.channelPropertiesChanged()
        },
        channel () {
            this.setPosition()
            this.checkChannels()
            this.channelPropertiesChanged()
        },
        viewerHeight () {
            this.setPosition()
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
        channelPropertiesChanged () {
            if (this.updating) {
                // Prevent setting properties (to undefined) while updating multiple channels.
                return
            }
            let commonSensitivity = this.channels[0]?.sensitivity as number | null
            let commonPolarity = this.channels[0]?.displayPolarity as -1 | 0 | 1 | null
            let commonScale = this.channels[0]?.scale as number | null
            let commonHighpass = this.channels[0]?.highpassFilter as number | null
            let commonLowpass = this.channels[0]?.lowpassFilter as number | null
            let commonNotch = this.channels[0]?.notchFilter as number | null
            for (let i=1; i<this.channels.length; i++) {
                const chan = this.channels[i]
                if (commonSensitivity !== null) {
                    if (chan.sensitivity !== commonSensitivity) {
                        // If channels have different values, set to an undefined value
                        commonSensitivity = null
                    }
                }
                if (commonPolarity !== null) {
                    if (chan.displayPolarity !== commonPolarity) {
                        commonPolarity = null
                    }
                }
                if (commonScale !== null) {
                    if (chan.scale !== commonScale) {
                        commonScale = null
                    }
                }
                if (commonHighpass !== null) {
                    if (chan.highpassFilter !== commonHighpass) {
                        commonHighpass = null
                    }
                }
                if (commonLowpass !== null) {
                    if (chan.lowpassFilter !== commonLowpass) {
                        commonLowpass = null
                    }
                }
                if (commonNotch !== null) {
                    if (chan.notchFilter !== commonNotch) {
                        commonNotch = null
                    }
                }
            }
            this.sensitivity = commonSensitivity
            this.polarity = commonPolarity
            this.scale = commonScale
            this.highpass = commonHighpass
            this.lowpass = commonLowpass
            this.notch = commonNotch
        },
        checkChannels () {
            const trueChans = this.RESOURCE.activeMontage
                              ? this.RESOURCE.activeMontage.channels.filter(c => c) as MontageChannel[]
                              : this.RESOURCE.channels
            if (!trueChans) {
                this.channels = []
                return
            }
            const activeChans = trueChans.filter(c => c.isActive)
            this.channels = activeChans
        },
        close () {
            this.channel.isActive = false
            this.$emit('close')
        },
        setHighpassFilter (value: string) {
            value = value.split(':')[1]
            this.updating = true
            for (const chan of this.channels) {
                chan.setHighpassFilter(value === 'null' ? null : parseFloat(value))
            }
            this.updating = false
        },
        setLowpassFilter (value: string) {
            value = value.split(':')[1]
            this.updating = true
            for (const chan of this.channels) {
                chan.setLowpassFilter(value === 'null' ? null : parseFloat(value))
            }
            this.updating = false
        },
        setNotchFilter (value: string) {
            value = value.split(':')[1]
            this.updating = true
            for (const chan of this.channels) {
                chan.setNotchFilter(value === 'null' ? null : parseInt(value))
            }
            this.updating = false
        },
        setPolarity (value: string) {
            value = value.split(':')[1]
            this.updating = true
            for (const chan of this.channels) {
                chan.displayPolarity = parseInt(value) as -1 | 0 | 1
            }
            this.updating = false
        },
        setPosition () {
            const chanLabelTop = (1 - this.channel.offset.baseline)*this.overlay.getOffsetHeight() - 10
            // If channel label top edge is far enough from container bottom, set container to align with that
            if (this.overlay.getOffsetHeight() - chanLabelTop > this.component.offsetHeight) {
                this.component.style.bottom = ''
                this.component.style.top = chanLabelTop + 'px'
            } else if (this.component.offsetHeight < this.overlay.getOffsetHeight()) {
                this.component.style.top = ''
                this.component.style.bottom = '0'
            } else {
                this.component.style.bottom = ''
                this.component.style.top = '0'
            }
            if (this.component.style.visibility !== 'visible') {
                this.component.style.visibility = 'visible'
            }
        },
        setScale (value: string) {
            value = value.split(':')[1]
            this.updating = true
            for (const chan of this.channels) {
                chan.scale = parseFloat(value)
            }
            this.updating = false
        },
        setSensitivity (value: string) {
            value = value.split(':')[1]
            this.updating = true
            const scale = this.SETTINGS.sensitivity[this.SETTINGS.sensitivityUnit]?.scale || 1
            for (const chan of this.channels) {
                chan.sensitivity = parseInt(value)*scale
            }
            this.updating = false
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
        // Listen to recording property changes.
        this.RESOURCE.onPropertyChange('channels', this.channelPropertiesChanged, this.ID)
        // Close component on overlay click
        this.overlay.$el.addEventListener('pointerup', this.close)
        this.checkChannels()
        this.channelPropertiesChanged()
        this.setPosition()
    },
    beforeUnmount () {
        this.RESOURCE.removeAllEventListeners(this.ID)
        this.overlay.$el.removeEventListener('pointerup', this.close)
    }
})
</script>

<style scoped>
[data-component="eeg-channel-properties"] {
    position: absolute;
    left: 0;
    width: 12.5rem;
    height: fit-content;
    padding-bottom: 0.25rem;
    visibility: hidden; /* Hide the component until position has been set */
    border: solid 1px var(--epicv-border);
    border-radius: 0.25rem;
    background-color: var(--epicv-background);
    z-index: 4;
}
.title {
    width: 11rem;
    height: 1.5rem;
    line-height: 1.5rem;
    padding: 0 0.5rem;
    font-size: 0.8rem;
    background-color: var(--epicv-background-emphasize);
    border-bottom: solid 1px var(--epicv-border);
    font-variant: small-caps;
}
.close {
    position: absolute;
    top: 0;
    right: 0;
    width: 1.5rem;
    height: 1.5rem;
    line-height: 1.5rem;
    font-size: 0.8rem;
    text-align: center;
    background-color: var(--epicv-background-emphasize);
    border-bottom: solid 1px var(--epicv-border);
    cursor: pointer;
}
    .close:hover {
        background-color: var(--epicv-background-highlight);
    }
.header {
    height: 1.5rem;
    line-height: 1.5rem;
    margin-bottom: 0.25rem;
    padding: 0 0.5rem;
    font-size: 0.8rem;
    background-color: var(--epicv-background-highlight);
}
.space {
    height: 0.25rem;
}
.property {
    display: flex;
    position: relative;
    height: 1.5rem;
    line-height: 1.5rem;
    padding: 0 0.5rem;
    font-size: 0.8rem;
}
    .name {
        flex: 1;
    }
    .value {
        flex: 1.5;
    }
        .value select {
            width: 100%;
        }
        .value wa-select {
            width: 100%;
            height: 1.5rem;
            min-height: 1.5rem;
            max-height: 1.5rem;
        }
        .value wa-select::part(combobox) {
            background-color: transparent;
            border: none;
            height: 1.5rem;
            min-height: 1.5rem;
            max-height: 1.5rem;
            padding: 0 0.25rem;
            font-size: 0.8rem;
        }
            .value wa-select wa-option {
                padding: 0 0.25rem;
                font-size: 0.8rem;
            }
            .value wa-select wa-option span[slot=start] {
                font-family: var(--epicv-font-monospace);
                font-size: 0.8em;
                opacity: 0.75;
            }
            .value wa-select wa-option span[slot=end] {
                font-size: 0.9em;
                opacity: 0.75;
                margin-inline-end: 0.5em;
            }
</style>
