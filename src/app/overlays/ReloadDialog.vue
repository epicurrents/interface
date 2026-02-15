<template>
    <wa-dialog ref="dialog"
        class="epicv-dialog"
        :label="$t(title)"
        :style="`--width:40rem;`"
        @click.stop=""
    >
        <div class="content" v-if="content">{{ content }}</div>
        <wa-button class="confirm" slot="footer" @click="reload">{{ $t('Reload') }}</wa-button>
        <wa-button class="abort" slot="footer" @click="closeDialog">{{ $t('Cancel') }}</wa-button>
    </wa-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, Ref } from "vue"
import { T } from "#i18n"
//import { useStore } from "vuex"

export default defineComponent({
    name: 'ReloadDialog',
    components: {
    },
    props: {
        content: {
            type: String,
            required: false,
        },
        title: {
            type: String,
            required: true,
        },
    },
    setup () {
        //const store = useStore()
        // DOM
        const dialog = ref<HTMLDivElement>() as Ref<any>
        return {
            dialog,
        }
    },
    watch: {
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
        closeDialog (event: Event) {
            event.preventDefault()
            this.$emit('close')
        },
        overlayClicked () {
            this.$emit('close')
        },
        reload () {
            location.reload()
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
        this.dialog.addEventListener('wa-after-close', this.closeDialog)
    },
    beforeUnmount () {
        this.dialog.removeEventListener('wa-after-close', this.closeDialog)
    },
})
</script>

<style scoped>
.content {
    padding: 0.25rem;
    line-height: 1.5em;
    white-space: pre-line;
}
</style>
