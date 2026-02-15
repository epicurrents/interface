<template>
        <wa-dialog data-component="welcome-dialog"
            class="epicv-welcome-dialog"
            :label="$t('Welcome to using Epicurrents!')"
            light-dismiss="This is needed to display the hint"
            :open="open"
            ref="dialog"
            without-header
            @wa-hide="preventDialogDismissal"
        >
            <h4>{{ $t('welcome.title') }}</h4>
            <h5>
                <app-icon name="circle-exclamation"></app-icon>
                {{ $t('welcome.instruction') }}
            </h5>
            <!-- Dialog body -->
            <p>{{ $t('welcome.warranty') }}</p>
            <p>{{ $t('welcome.medical') }}</p>
            <div v-if="$config.user" class="auth">
                <wa-select v-if="$config.user.nameOptions"
                    id="select-user-name"
                    :placeholder="$t('welcome.select')"
                    v-property="'userName'"
                    @wa-hide.stop=""
                >
                    <template v-for="option in $config.user.nameOptions">
                        <wa-divider v-if="option.name === 'HORIZONTAL_DIVIDER'"></wa-divider>
                        <wa-option v-else
                            :key="`username-option-${option.name}`"
                            :value="option.name"
                        >{{ option.label || option.name }}</wa-option>
                    </template>
                </wa-select>
                <div v-else class="credentials">
                    <wa-input
                        :placeholder="$t('welcome.username')"
                        v-property="'userName'"
                    ></wa-input>
                    <wa-input v-if="$config.user.authenticationBackend"
                        :placeholder="$t('welcome.password')"
                        type="password"
                        v-property="'password'"
                    ></wa-input>
                    <wa-button v-if="$config.user.authenticationBackend"
                        appearance="filled-outlined"
                        variant="brand"
                        @click="login"
                    >
                        {{ $t('welcome.login') }}
                    </wa-button>
                </div>
            </div>
            <!-- Dialog footer -->
            <div
                :class="[
                    'notice',
                    { 'epicv-hidden' : !displayNotice },
                ]"
                slot="footer"
            >
                {{ $t(
                    displayLoginError
                    ? 'welcome.notice.error'
                    : displayLoginNotice
                        ? 'welcome.notice.login'
                        : 'welcome.notice.disclaimer'
                ) }}
            </div>
            <wa-button id="accept-disclaimer-button"
                appearance="filled-outlined"
                data-dialog="close"
                slot="footer"
                variant="brand"
            >
                {{ $t('welcome.accept') }}
            </wa-button>
        </wa-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, Ref } from "vue"
import { T } from "#i18n"
import { Log } from "scoped-event-log"
import type { default as WaDialog } from '@awesome.me/webawesome/dist/components/dialog/dialog.js'
//import { useStore } from "vuex"

export default defineComponent({
    name: 'WelcomeDialog',
    components: {
    },
    props: {
        open: {
            type: Boolean,
            default: false,
        },
    },
    setup () {
        //const store = useStore()
        const displayDisclaimerNotice = ref(false)
        const displayLoginError = ref(false)
        const displayLoginNotice = ref(false)
        const isLoggedIn = ref(false)
        const password = ref('')
        const userName = ref('')
        // DOM
        const dialog = ref<WaDialog>() as Ref<WaDialog>
        return {
            displayDisclaimerNotice,
            displayLoginError,
            displayLoginNotice,
            isLoggedIn,
            password,
            userName,
            dialog,
        }
    },
    watch: {
        userName (value: string) {
            if (!this.$config.user.authenticationBackend) {
                if (value.length > 0) {
                    this.isLoggedIn = true
                    this.displayLoginNotice = false
                } else {
                    this.isLoggedIn = false
                }
            }
        }
    },
    computed: {
        displayNotice (): boolean {
            return this.displayDisclaimerNotice || this.displayLoginError || this.displayLoginNotice
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
         * Attempt to log in the user via the configured authentication backend.
         */
        async login () {
            if (!this.$config.user?.authenticationBackend) {
                this.$store.dispatch('set-settings-value', { field: 'app.userName', value: this.userName })
                this.isLoggedIn = true
                return true
            } else {
                // Attempt to log in via backend.
                try {
                    const response = await fetch(this.$config.user.authenticationBackend, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            username: this.userName,
                            password: this.password,
                        }),
                    })
                    if (response.ok) {
                        this.$store.dispatch('set-settings-value', { field: 'app.userName', value: this.userName })
                        this.isLoggedIn = true
                        Log.info(`User '${this.userName}' logged in successfully.`, this.$options.name!)
                        return true
                    } else {
                        const errorText = await response.text()
                        Log.warn(`Login failed: ${errorText}`, this.$options.name!)
                        this.displayLoginError = true
                    }
                } catch (error) {
                    Log.error(`Login error: ${error}`, this.$options.name!)
                    this.displayLoginError = true
                }
            }
            return false
        },
        /**
         * Prevent the dialog from being dismissed until the user has accepted the disclaimer.
         * @param event - Hide event from the dialog.
         */
        preventDialogDismissal (event: CustomEvent) {
            this.displayDisclaimerNotice = false
            this.displayLoginError = false
            this.displayLoginNotice = false
            // Display a hint that the dialog cannot be dismissed.
            const acceptButton = this.dialog.querySelector('#accept-disclaimer-button')
            if (event.detail?.source !== acceptButton && !this.$store.state.INTERFACE.app.disclaimerAccepted) {
                if (this.$config.user && !this.isLoggedIn) {
                    this.displayLoginNotice = true
                } else {
                    this.displayDisclaimerNotice = true
                }
                event.preventDefault()
                event.stopPropagation()
            } else {
                if (this.userName && this.$store.state.INTERFACE.app.userName !== this.userName) {
                    this.login()
                }
                Log.debug(`User accepted the disclaimer.`, this.$options.name!)
                this.$store.dispatch('accept-disclaimer')
                event.stopPropagation()
            }
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
[data-component="welcome-dialog"] {
    --width: max(60%, 600px);
}
[data-component="welcome-dialog"] h4 {
    margin: 1em 0;
}
[data-component="welcome-dialog"] h5 {
    height: 1.25em;
    line-height: 1.25em;
    margin-bottom: 1.25rem;
}
[data-component="welcome-dialog"] wa-icon {
    vertical-align: top;
    font-size: 1.25em;
    margin-right: 0.25em;
    color: darkred;
}
[data-component="welcome-dialog"] p {
    line-height: 1.5em;
    margin-bottom: 0;
    margin-top: 0.75rem;
}
.notice {
    width: auto;
    height: 40px;
    line-height: 40px;
    float: left;
    color: darkred;
    font-weight: bold;
}
[data-component="welcome-dialog"]::part(footer) {
    padding-top: 0.75rem;
}
.auth {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem 0 0.25rem 0;
}
    .auth wa-select wa-divider {
        margin: 0.5rem 0;
    }
.credentials {
    display: flex;
    gap: 0.5rem;
}
.epicv-disclaimer-notice {
    font-size: 0.875rem;
    color: var(--wa-color-text-secondary);
    text-align: center;
}
    .credentials > * {
        flex: 1;
    }
</style>
