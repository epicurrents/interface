<template>
    <wa-dialog ref="dialog"
        class="epicv-dialog"
        data-component="url-loader-dialog"
        :label="$t(title)"
        :style="`--width:40rem;`"
        @click.stop=""
        @wa-after-show="focusInput"
        @wa-close="closeDialog"
    >
        <div class="urlrow">
            <wa-input
                autofocus
                :placeholder="$t(`Enter resource URL`)"
                v-property="'url'"
            ></wa-input>
            <wa-button appearance="filled-outlined" :disabled="!url.length" @click="openResource">
                {{ $t(`Open`) }}
            </wa-button>
        </div>
        <wa-divider></wa-divider>
        <wa-details :summary="$t(`Authentication`)"
            @wa-after-hide.stop=""
            @wa-hide.stop=""
        >
            <div class="hint">
                <div class="hint-icon">
                    <app-icon
                        :class="[
                            'inline',
                            allowAuth ? 'available' : 'unavailable',
                        ]"
                        :name="allowAuth ? 'circle-info' : 'triangle-exclamation'"
                    ></app-icon>
                </div>
                <div class="hint-text">
                    <div v-for="(hint, idx) of (Array.isArray(authHint) ? authHint : [authHint])"
                        :key="`auth-hint-${idx}`"
                    >
                        {{ hint }}
                    </div>
                </div>
            </div>
            <template v-if="allowAuth">
                <wa-input
                    :placeholder="$t(`Username`)"
                    v-property="'username'"
                ></wa-input>
                <wa-input
                    password-toggle
                    :placeholder="$t(`Password`)"
                    type="password"
                    v-property="'password'"
                ></wa-input>
            </template>
        </wa-details>
    </wa-dialog>
</template>

<script lang="ts">
/**
 * This component provides instructions on how to use the application.
 */
import { defineComponent, ref, Ref } from "vue"
import { T } from "#i18n"
import type { default as WaDialog } from '@awesome.me/webawesome/dist/components/dialog/dialog.js'
//import { useStore } from "vuex"

export default defineComponent({
    name: 'UrlLoaderDialog',
    components: {
    },
    props: {
        title: {
            type: String,
            required: true,
        },
    },
    setup () {
        //const store = useStore()
        const password = ref('')
        const url = ref('')
        const username = ref('')
        // DOM
        const dialog = ref<WaDialog>() as Ref<WaDialog>
        return {
            password,
            url,
            username,
            dialog,
        }
    },
    computed: {
        allowAuth () {
            if (window.location.protocol !== 'https:' || !this.url.startsWith('https://')) {
                // Only allow sending usernames and passwords over secure connections.
                return false
            }
            // Disable basic auth for now (implementation incomplete).
            return false
        },
        authHint () {
            if (this.allowAuth) {
                return this.$t(`If the server requires basic authentication, add your credentials here.`)
            }
            if (!window.__EPICURRENTS__.SETUP.allowInsecureAuth && window.location.protocol !== 'https:') {
                return this.$t(`Basic authentication is only available if the app is served over HTTPS.`)
            }
            if (!this.url.length) {
                return window.__EPICURRENTS__.SETUP.allowInsecureAuth
                       ? this.$t(`Please enter a URL...`)
                       : this.$t(`Please enter a URL starting with https://...`)
            }
            if (!window.__EPICURRENTS__.SETUP.allowInsecureAuth && !this.url.startsWith('https://')) {
                return [
                    this.$t(`Basic authentication is only available for resources served over HTTPS.`),
                    this.$t(`The given URL does not start with 'https://'.`)
                ]
            }
            return this.$t(`Basic authentication feature is not yet available.`)
        },
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
        focusInput () {
            // Autofocus on the input does not work for some reason...
            const input = this.dialog.querySelector('wa-input')
            if (input) {
                requestAnimationFrame(() => input.focus())
            }
        },
        openResource () {
            if (!this.url.length) {
                return
            }
            this.$emit('open-url', { url: this.url, username: this.username, password: this.password })
        },
        overlayClicked () {
            this.$emit('close')
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
    },
    beforeUnmount () {
    },
})
</script>

<style scoped>
[data-component="url-loader-dialog"]::part(body) {
    padding-bottom: 1rem;
    padding-top: 0.25rem;
}
.urlrow {
    display: flex;
}
    .urlrow wa-input {
        flex: 1 1 0;
        margin-inline-end: 0.5rem;
    }
[data-component="url-loader-dialog"] wa-details::part(content) {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
        [data-component="url-loader-dialog"] wa-details div wa-icon {
            margin-inline-end: 0.25em;
        }
        .hint {
            display: flex;
            flex-direction: row;
            align-items: center;
            margin-bottom: 0.5rem;
        }
        .hint-icon {
            flex: 0 0 2.5rem;
            height: 1.5rem;
            line-height: 1.5rem;
            text-align: center;
        }
            .hint-icon wa-icon.available {
                color: var(--epicv-icon-default);
            }
            .hint-icon wa-icon.unavailable {
                color: var(--epicv-warning);
            }
        .hint-text {
            flex: 1 1 auto;
        }
        .hint-text div {
            height: 1.5rem;
            line-height: 1.5rem;
        }
</style>
