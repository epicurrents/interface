<template>
    <wa-dialog ref="dialog"
        class="epicv-dialog"
        data-component="signal-export-receipt-dialog"
        :label="$t('Receipt')"
        :open="open"
        :style="`--width:40rem;`"
        @click.stop=""
        @keydown.stop=""
        @keyup.stop=""
        @wa-close="closeDialog"
    >
        <p>
            {{ $t('The destination handed back a receipt for the recording. Save or copy it now: it may not be possible to obtain it again once this window is closed.') }}
        </p>
        <pre class="receipt">{{ receipt?.data || '' }}</pre>
        <p v-if="copied" class="epicv-text-faint">{{ $t('The receipt was copied to the clipboard.') }}</p>
        <wa-button
            slot="footer"
            variant="brand"
            @click="download"
        >
            {{ $t('Download receipt') }}
        </wa-button>
        <wa-button
            slot="footer"
            @click="copy"
        >
            {{ $t('Copy') }}
        </wa-button>
        <wa-button
            appearance="plain"
            slot="footer"
            @click="closeDialog"
        >
            {{ $t('Close') }}
        </wa-button>
    </wa-dialog>
</template>

<script lang="ts">
/**
 * Shows a receipt an export target handed back for the recording it received, and saves or copies it on request.
 *
 * The receipt is the destination's; the dialog presents its text as given and knows nothing of what it names. It is
 * shown rather than downloaded unasked because the person may decline or miss a download, and a receipt is the kind of
 * record a destination may be unable to issue again. The dialog stays until closed by hand, so a missed download can be
 * repeated.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { defineComponent, PropType, ref } from "vue"
import { T } from "#i18n"
import type { SignalExportReceipt } from "@epicurrents/core/types"
import Log from "scoped-event-log"

const SCOPE = 'SignalExportReceiptDialog'

export default defineComponent({
    name: 'SignalExportReceiptDialog',
    props: {
        open: {
            type: Boolean,
            default: false,
        },
        receipt: {
            type: Object as PropType<SignalExportReceipt | null>,
            default: null,
        },
    },
    emits: ['close', 'download'],
    setup () {
        const copied = ref(false)
        return {
            copied,
        }
    },
    watch: {
        open (value: boolean) {
            if (value) {
                this.copied = false
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
        closeDialog () {
            this.$emit('close')
        },
        async copy () {
            if (!this.receipt) {
                return
            }
            try {
                await navigator.clipboard.writeText(this.receipt.data)
                this.copied = true
            } catch (error) {
                Log.error(`Copying the receipt failed.`, SCOPE, error as Error)
            }
        },
        download () {
            if (this.receipt) {
                this.$emit('download', this.receipt)
            }
        },
    },
})
</script>

<style scoped>
.receipt {
    background-color: var(--epicv-background-emphasize);
    border: 1px solid var(--epicv-border);
    font-family: monospace;
    overflow-x: auto;
    padding: 0.5rem;
    user-select: text;
    white-space: pre-wrap;
    word-break: break-all;
}
</style>
