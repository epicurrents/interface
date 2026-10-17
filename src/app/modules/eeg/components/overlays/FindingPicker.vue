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
            <!-- One tab stop for the whole list: the arrow keys move within it, as from the search field. -->
            <div v-if="results.length" ref="list"
                :aria-activedescendant="`finding-result-${highlighted}`"
                class="results"
                role="listbox"
                tabindex="0"
                @keydown="handleListKeydown"
            >
                <button v-for="(finding, idx) of results" :key="`finding-result-${finding.term.name}`"
                    :aria-selected="idx === highlighted"
                    :class="['result', { 'result--active': idx === highlighted }]"
                    :id="`finding-result-${idx}`"
                    role="option"
                    tabindex="-1"
                    :title="finding.term.description"
                    type="button"
                    @click="pick(finding)"
                    @mousedown.prevent
                    @mousemove="highlightResult(idx)"
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
import { defineComponent, PropType, Ref, ref, shallowRef } from "vue"
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
        /**
         * Moves focus to what follows a pick, such as the editor's save button. Without it the picker focuses its
         * own remove button, since the search field a pick replaces held the focus and an editor that loses it closes.
         */
        focusNext: {
            type: Function as PropType<() => void>,
            default: null,
        },
    },
    emits: ['change'],
    setup () {
        const clearbtn = ref<WaButton>() as Ref<WaButton>
        const group = ref('')
        const highlighted = ref(0)
        const index = shallowRef<HedScoreTermIndex | null>(null)
        const list = ref<HTMLDivElement>()
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
            list,
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
        handleListKeydown (event: KeyboardEvent) {
            this.navigateResults(event)
        },
        handleSearchKeydown (event: KeyboardEvent) {
            if (this.navigateResults(event)) {
                return
            }
            if (event.key === 'Escape' && (this.query || this.group)) {
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
        /**
         * Highlight the result under the pointer. Bound to pointer movement rather than entry, so a list scrolled
         * under a still pointer by the arrow keys keeps the keyboard's highlight.
         * @param idx - Index of the result.
         */
        highlightResult (idx: number) {
            if (this.highlighted !== idx) {
                this.highlighted = idx
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
        /**
         * Move the highlight through the results, or pick the highlighted one, for a key pressed in the search field
         * or the list. Returns whether the key was one of these.
         * @param event - The key event.
         */
        navigateResults (event: KeyboardEvent) {
            const count = this.results.length
            if (!count) {
                return false
            }
            let next = this.highlighted
            if (event.key === 'ArrowDown') {
                next = (this.highlighted + 1)%count
            } else if (event.key === 'ArrowUp') {
                next = (this.highlighted - 1 + count)%count
            } else if (event.key === 'Home') {
                next = 0
            } else if (event.key === 'End') {
                next = count - 1
            } else if (event.key === 'Enter') {
                event.preventDefault()
                this.pick(this.results[Math.min(this.highlighted, count - 1)])
                return true
            } else {
                return false
            }
            event.preventDefault()
            this.highlighted = next
            this.$nextTick(() => {
                this.list?.children[next]?.scrollIntoView({ block: 'nearest' })
            })
            return true
        },
        pick (finding: OfferedFinding) {
            rememberFinding(finding.term.name)
            this.query = ''
            this.group = ''
            this.highlighted = 0
            this.$emit('change', finding.term.name)
            if (this.focusNext) {
                this.focusNext()
                return
            }
            this.$nextTick(() => {
                this.clearbtn?.focus()
            })
        },
        selectGroup (branch: string) {
            this.group = branch || ''
            this.query = ''
            this.highlighted = 0
            if (this.group) {
                // Into the group's list, so the arrow keys move through it rather than reopening the menu.
                this.$nextTick(() => {
                    this.list?.focus()
                })
            }
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
        color: var(--epicv-icon-default);
    }
    .row wa-input,
    .row .selected {
        flex: 1 1 0;
    }
    .row wa-input{
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
    background-color: var(--epicv-background-focus);
    border: solid 1px var(--epicv-border);
    border-radius: 0.25rem;
    color: var(--epicv-text-emphasis);
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
    margin-left: 2rem;
    overflow-y: auto;
    border: solid 1px var(--epicv-border);
    border-radius: 0.25rem;
}
    .results:focus {
        outline: none;
    }
    .results:focus-visible {
        border-color: var(--epicv-border-focus);
    }
.result {
    padding: 0.25rem 0.5rem;
    border: none;
    background-color: var(--epicv-background);
    border-radius: 0;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
}
    .result:hover,
    .result--active {
        background-color: var(--epicv-background-hover);
    }
.palette {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-left: 2rem;
}
.palette-item {
    padding: 0.125rem 0.5rem;
    border: solid 1px var(--epicv-border);
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
    margin-left: 2rem;
    opacity: 0.8;
}
.attribution {
    margin-left: 2.25rem;
    font-size: 0.75rem;
    opacity: 0.6;
}
</style>
