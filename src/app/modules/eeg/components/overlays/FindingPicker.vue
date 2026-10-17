<template>
    <div v-if="state !== 'hidden'" data-component="finding-picker">
        <div v-if="state === 'loading'" class="status">
            <wa-spinner></wa-spinner>
        </div>
        <div v-else-if="state === 'unavailable'" class="status">{{ statusMessage }}</div>
        <template v-else>
            <div class="row">
                <app-icon class="icon" name="wave-pulse"></app-icon>
                <div v-if="code" class="selected" :title="selectedDescription">
                    <span class="label">{{ selectedLabel }}</span>
                    <wa-button ref="clearbtn"
                        appearance="plain"
                        :disabled="disabled"
                        id="finding-picker-clear-button"
                        size="s"
                        @click="clear"
                    >
                        <app-icon name="xmark"></app-icon>
                    </wa-button>
                    <wa-tooltip for="finding-picker-clear-button">{{ $t('Remove finding') }}</wa-tooltip>
                </div>
                <wa-input v-else ref="search"
                    :disabled="disabled"
                    :placeholder="$t('Finding')"
                    size="s"
                    :value="query"
                    @input="updateQuery($event.target.value)"
                    @keydown="handleSearchKeydown"
                ></wa-input>
                <wa-select v-if="!code"
                    :disabled="disabled"
                    :placeholder="$t('Browse')"
                    size="s"
                    :value="group"
                    with-clear
                    @input="selectGroup($event.target.value)"
                >
                    <wa-option v-for="findingGroup of groups" :key="`finding-group-${findingGroup.branch}`"
                        :value="findingGroup.branch"
                    >{{ $t(findingGroup.label) }}</wa-option>
                </wa-select>
            </div>
            <div v-if="results.length" class="results" role="listbox">
                <button v-for="(finding, idx) of results" :key="`finding-result-${finding.term.name}`"
                    :aria-selected="idx === highlighted"
                    :class="['result', { 'result--active': idx === highlighted }]"
                    role="option"
                    :title="finding.term.description"
                    type="button"
                    @click="pick(finding)"
                    @mousedown.prevent
                >{{ finding.label }}</button>
            </div>
            <div v-if="palette.length && !code" class="palette">
                <button v-for="(finding, idx) of palette" :key="`finding-palette-${finding.term.name}`"
                    class="palette-item"
                    :disabled="disabled"
                    :title="finding.term.description"
                    type="button"
                    @click="pick(finding)"
                    @mousedown.prevent
                >
                    <span v-if="idx < 10" class="key">{{ (idx + 1)%10 }}</span>
                    {{ finding.label }}
                </button>
            </div>
            <div class="attribution" :title="attribution">{{ attributionShort }}</div>
        </template>
    </div>
</template>

<script lang="ts">
/**
 * Codes an annotation's finding in HED-SCORE: a search field over the offered terms, a browsable list per group, and
 * the host's quick palette. Emits the short-form tag to store under `codes.hed`, or `null` to remove it.
 *
 * The terms come from eeg-module's index, loaded when the picker first opens. The host's policy, when one is
 * configured, narrows what is offered to what its server accepts, hides the picker when the server takes no HED
 * codes, and disables it when the server validates against another schema release.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */
import { defineComponent, Ref, ref, shallowRef } from "vue"
import { T } from "#i18n"
import { loadHedScoreIndex } from "@epicurrents/eeg-module"
import type { HedScoreTermIndex } from "@epicurrents/eeg-module/types"
import type { default as WaButton } from "@awesome.me/webawesome/dist/components/button/button.js"
import type { default as WaInput } from "@awesome.me/webawesome/dist/components/input/input.js"
import { runtime } from "#app/modules/eeg"
import {
    FINDING_GROUPS,
    type OfferedFinding,
    findingLabel,
    findingPolicy,
    offeredFindings,
    paletteFindings,
    policyMismatch,
    recentFindings,
    rememberFinding,
    searchFindings,
} from "#app/modules/eeg/findings"
import { Log } from "scoped-event-log"

const SCOPE = 'FindingPicker'

export default defineComponent({
    name: SCOPE,
    props: {
        /** The finding's current HED string, empty when none is coded. */
        code: {
            type: String,
            default: '',
        },
        disabled: {
            type: Boolean,
            default: false,
        },
    },
    emits: ['change'],
    setup () {
        const clearbtn = ref<WaButton>() as Ref<WaButton>
        const group = ref('')
        const highlighted = ref(0)
        const index = shallowRef<HedScoreTermIndex | null>(null)
        const offered = shallowRef<OfferedFinding[]>([])
        const query = ref('')
        const search = ref<WaInput>() as Ref<WaInput>
        const state = ref<'hidden' | 'loading' | 'ready' | 'unavailable'>('loading')
        const statusMessage = ref('')
        return {
            clearbtn,
            group,
            groups: FINDING_GROUPS,
            highlighted,
            index,
            offered,
            query,
            search,
            state,
            statusMessage,
        }
    },
    computed: {
        attribution (): string {
            return this.index?.attribution ?? ''
        },
        attributionShort (): string {
            return this.index ? `HED-SCORE ${this.index.schema.version} · CC BY 4.0` : ''
        },
        palette (): OfferedFinding[] {
            return paletteFindings(this.offered, runtime.hedScore.palette)
        },
        results (): OfferedFinding[] {
            if (this.code) {
                return []
            }
            if (this.query.trim()) {
                return searchFindings(this.offered, this.query, recentFindings())
            }
            if (this.group) {
                return this.offered.filter(finding => finding.branch === this.group)
            }
            return []
        },
        selectedDescription (): string {
            return this.index?.getTerm(this.code)?.description ?? ''
        },
        selectedLabel (): string {
            // A string the picker did not write, such as a grouped one, is shown as stored.
            return this.index?.getTerm(this.code) ? findingLabel(this.code) : this.code
        },
    },
    // The result and palette buttons take no focus on press: a browser that does not focus a pressed button would
    // otherwise leave the editor with nothing focused, and an editor that loses focus closes before the click lands.
    methods: {
        /**
         * Override the default I18n translate method.
         * Returns a component-specific translation (default) or a
         * general translation (fallback) for the given key string.
         */
        $t: function (key: string, params = {}, capitalized = false) {
            return T(key, this.$options.name, params, capitalized)
        },
        clear () {
            this.$emit('change', null)
            this.$nextTick(() => {
                this.search?.focus()
            })
        },
        handleSearchKeydown (event: KeyboardEvent) {
            if (event.key === 'ArrowDown' && this.results.length) {
                event.preventDefault()
                this.highlighted = (this.highlighted + 1)%this.results.length
            } else if (event.key === 'ArrowUp' && this.results.length) {
                event.preventDefault()
                this.highlighted = (this.highlighted - 1 + this.results.length)%this.results.length
            } else if (event.key === 'Enter' && this.results.length) {
                event.preventDefault()
                this.pick(this.results[this.highlighted])
            } else if (event.key === 'Escape' && (this.query || this.group)) {
                event.preventDefault()
                this.query = ''
                this.group = ''
            } else if (/^[0-9]$/.test(event.key) && !this.query && this.palette.length) {
                // The number keys pick from the palette while nothing has been typed; no term starts with a digit.
                const finding = this.palette[(Number(event.key) + 9)%10]
                if (finding) {
                    event.preventDefault()
                    this.pick(finding)
                }
            }
        },
        async load () {
            try {
                const [index, policy] = await Promise.all([
                    loadHedScoreIndex(),
                    findingPolicy(runtime.hedScore.policy),
                ])
                this.index = index
                if (runtime.hedScore.policy && !policy) {
                    // The host's server takes no HED codes.
                    this.state = 'hidden'
                    return
                }
                const mismatch = policyMismatch(index, policy)
                if (mismatch) {
                    this.statusMessage = mismatch === 'version'
                        ? this.$t(
                            'The server validates findings against HED-SCORE {server}; this viewer has {viewer}.',
                            { server: policy!.schema.version, viewer: index.schema.version },
                        )
                        : this.$t(
                            'The server and this viewer have different copies of HED-SCORE {version}.',
                            { version: index.schema.version },
                        )
                    this.state = 'unavailable'
                    return
                }
                this.offered = offeredFindings(index, policy)
                this.state = 'ready'
            } catch (e) {
                Log.error(`Could not load the finding terms.`, SCOPE, e as Error)
                this.statusMessage = this.$t('Findings cannot be coded right now.')
                this.state = 'unavailable'
            }
        },
        pick (finding: OfferedFinding) {
            rememberFinding(finding.term.name)
            this.query = ''
            this.group = ''
            this.highlighted = 0
            this.$emit('change', finding.term.name)
            // The focused field is replaced by the selection, and an editor that loses focus closes.
            this.$nextTick(() => {
                this.clearbtn?.focus()
            })
        },
        selectGroup (branch: string) {
            this.group = branch || ''
            this.query = ''
            this.highlighted = 0
        },
        updateQuery (value: string) {
            this.query = value
            this.highlighted = 0
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
        this.load()
    },
})
</script>

<style scoped>
[data-component="finding-picker"] {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
    padding-top: 0.25rem;
}
.row {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
}
    .row .icon {
        font-size: 1rem;
        margin: auto 0.5rem auto 0.25rem;
        color: #4488aa;
    }
    .row wa-input,
    .row .selected {
        flex: 1 1 0;
        margin-right: 0.25rem;
    }
    .row wa-select {
        flex: 0 0 12rem;
    }
.selected {
    display: flex;
    align-items: center;
    min-height: 1.75rem;
    padding-left: 0.5rem;
    border: solid 1px var(--epicv-border);
    border-radius: 0.25rem;
}
    .selected .label {
        flex: 1 1 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
.results {
    display: flex;
    flex-direction: column;
    max-height: 12rem;
    margin-left: 1.75rem;
    overflow-y: auto;
    border: solid 1px var(--epicv-border);
    border-radius: 0.25rem;
}
.result {
    padding: 0.25rem 0.5rem;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
}
    .result:hover {
        background-color: var(--epicv-background-hover);
    }
    .result--active {
        background-color: var(--epicv-background-highlight);
    }
.palette {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-left: 1.75rem;
}
.palette-item {
    padding: 0.125rem 0.5rem;
    border: solid 1px var(--epicv-border);
    border-radius: 0.25rem;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
}
    .palette-item:hover {
        background-color: var(--epicv-background-hover);
    }
    .palette-item .key {
        margin-right: 0.25rem;
        opacity: 0.6;
    }
.status {
    margin-left: 1.75rem;
    opacity: 0.8;
}
.attribution {
    margin-left: 1.75rem;
    font-size: 0.75rem;
    opacity: 0.6;
}
</style>
