<template>
    <div data-component="annotation-editor">
        <div class="editor"
            @focusout="lostFocus"
            @focusin="gotFocus"
        >
            <app-icon class="icon" :name="action === 'new' ? `bookmark-plus` : `pencil`"></app-icon>
            <wa-input ref="input"
                :value="annotationLabel"
                :placeholder="$t('Annotation text')"
                size="small"
                @input="updateLabel($event.target.value)"
                @keydown="handleLabelKeydown"
                @keyup="handleLabelKeyup"
            ></wa-input>
            <wa-select
                size="small"
                :value="annotationClass"
                @input="updateClass($event.target.value)"
            >
                <wa-option v-for="(annoClass, _idx) of SETTINGS.annotations.classes" :key="`anno-info-class-${annoClass.name}`"
                    :value="annoClass.name"
                >{{ $t(annoClass.label) }}</wa-option>
            </wa-select>
            <wa-button ref="savebtn"
                appearance="filled-outlined"
                id="annotation-editor-save-button"
                size="small"
                variant="brand"
                @click="save"
                @keydown="handleButtonKeydown"
                @keyup.stop=""
            >
                <app-icon name="floppy-disk" variant="light"></app-icon>
            </wa-button>
            <wa-tooltip for="annotation-editor-save-button">{{ $t('Save') }}</wa-tooltip>
        </div>
    </div>
</template>

<script lang="ts">
/**
 * Context menu for EEG annotation editing.
 */
import { Ref, defineComponent, ref } from "vue"
import { T } from "#i18n"
// Reimport to use as types.
import { Annotation } from "@epicurrents/core/types"
import { useStore } from "vuex"
import { useBiosignalContext } from "#config"
import { PropType } from "vue"
import type { default as WaInput } from "@awesome.me/webawesome/dist/components/input/input.js"
import type { default as WaButton } from "@awesome.me/webawesome/dist/components/button/button.js"

export default defineComponent({
    name: 'EegAnnotationEditor',
    props: {
        action: {
            type: String as PropType<'edit'|'new'>,
            default: 'new',
        },
        annotation: {
            type: Object as PropType<Annotation>,
            required: true,
        },
    },
    setup () {
        const store = useStore()
        const annotationClass = ref('event')
        const annotationLabel = ref('')
        const closeTimeout = ref(0)
        const input = ref<WaInput>() as Ref<WaInput>
        const savebtn = ref<WaButton>() as Ref<WaButton>
        return {
            annotationClass,
            annotationLabel,
            closeTimeout,
            input,
            savebtn,
            ...useBiosignalContext(store),
        }
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
        gotFocus () {
            if (this.closeTimeout) {
                window.clearTimeout(this.closeTimeout)
            }
        },
        handleButtonKeydown (event: KeyboardEvent) {
            // Stop all other keydown events from propagating except for Escape (to close the editor).
            if (event.key !== 'Escape') {
                event.stopPropagation()
                if (event.key === 'Tab' && !event.shiftKey) {
                    // Default navigation would jump to the next element, which resides outside of the editor
                    // panel and would thus close it. We'll prevent that and instead make it jump back to the
                    // fist element on the panel.
                    event.preventDefault()
                    this.input.focus()
                }
            }
        },
        handleLabelKeydown (event: KeyboardEvent) {
            // Stop all other keydown events from propagating except for Escape (to close the editor).
            if (event.key !== 'Escape') {
                event.stopPropagation()
                if (event.key === 'Tab' && event.shiftKey) {
                    // Same as with the button, but now we jump to the last element.
                    event.preventDefault()
                    this.savebtn.focus()
                }
            }
        },
        handleLabelKeyup (event: KeyboardEvent) {
            // Stop all keyup events from propagating to parent elements.
            event.stopPropagation()
            if (event.key === 'Enter') {
                // Save the annotation on enter.
                this.save()
            }
        },
        lostFocus () {
            // Not the most elegant solution, but it handles accessibility nicely.
            this.closeTimeout = window.setTimeout(() => {
                this.$emit('exit')
            }, 100)
        },
        save () {
            this.$emit('save', { class: this.annotationClass, label: this.annotationLabel })
        },
        updateClass (newClass: string) {
            this.annotationClass = newClass as typeof this.annotationClass
        },
        updateLabel (newLabel: string) {
            this.annotationLabel = newLabel
        }
    },
    beforeMount () {
        this.annotationClass = this.annotation.class
        this.annotationLabel = this.annotation.label
        // Add component styles to shadow root
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    mounted () {
        this.input?.updateComplete.then(() => {
            // Give the annotation text field focus after loading this element.
            this.input?.focus()
        })
    },
})
</script>

<style scoped>
[data-component="annotation-editor"] {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    padding: 0.5rem;
    pointer-events: none;
    z-index: 3;
}
.editor {
    display: flex;
    flex-wrap: nowrap;
    width: 100%;
    max-width: 40rem;
    min-width: 20rem;
    padding: 0.25rem;
    margin: auto;
    background-color: var(--epicv-background-focus);
    border: solid 1px var(--epicv-border);
    border-radius: 0.25rem;
    pointer-events: initial;
}
    .editor .icon {
        font-size: 1rem;
        margin: auto 0.5rem auto 0.25rem;
        color: #4488aa;
    }
    .editor wa-input {
        flex: 1 1 0;
        margin-right: 0.25rem;
    }
    .editor wa-select {
        flex: 0 0 8rem;
        margin-right: 0.25rem;
    }
    .editor wa-button wa-icon {
        font-size: 1rem;
    }
</style>
