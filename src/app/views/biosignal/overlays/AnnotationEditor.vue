<template>
    <div data-component="annotation-editor">
        <!-- Owns its keys, the save button's included, so typing and tabbing here never reach the hotkeys.
             Focusable by pointer only: a click on a part that takes no focus of its own, such as a label or the
             padding, focuses the panel instead of the page, so the editor does not read it as leaving and close. -->
        <div class="editor"
            data-owns-keys
            ref="panel"
            tabindex="-1"
            @focusout="lostFocus"
            @focusin="gotFocus"
            @keydown="handlePanelKeydown"
        >
            <app-icon class="icon" :name="icon"></app-icon>
            <wa-input ref="input"
                :disabled="isLocked"
                :placeholder="labelPlaceholder"
                size="s"
                :value="annotationLabel"
                @input="updateLabel($event.target.value)"
                @keydown="handleLabelKeydown"
                @keyup="handleLabelKeyup"
            ></wa-input>
            <wa-select
                :disabled="isLocked"
                size="s"
                :value="annotationClass"
                @input="updateClass($event.target.value)"
            >
                <wa-option v-for="(annoClass, _idx) of SETTINGS.annotations.classes" :key="`anno-info-class-${annoClass.name}`"
                    :value="annoClass.name"
                >{{ $t(annoClass.label) }}</wa-option>
            </wa-select>
            <!-- Before the save button in the tab order, after it on screen: a row of its own below. -->
            <div v-if="$slots.codes" class="codes">
                <slot name="codes"
                    :annotation="annotation"
                    :applyToGroup="applyToGroup"
                    :codes="annotationCodes"
                    :disabled="isLocked"
                    :focusSave="focusSave"
                    :setCode="setCode"
                    :stamp="stamp"
                ></slot>
            </div>
            <wa-button v-if="!isLocked" ref="savebtn"
                appearance="filled-outlined"
                id="annotation-editor-save-button"
                size="s"
                variant="brand"
                @click="save"
                @keydown="handleButtonKeydown"
            >
                <app-icon name="floppy-disk" variant="light"></app-icon>
            </wa-button>
            <wa-tooltip v-if="!isLocked" for="annotation-editor-save-button">{{ $t('Save') }}</wa-tooltip>
        </div>
    </div>
</template>

<script lang="ts">
/**
 * Editor overlay for an annotation's text and class, shared by the biosignal viewers.
 *
 * A viewer that codes annotations in a standard puts its own control in the `codes` slot, which receives the
 * annotation, the codes being edited, `setCode(standard, value)` to change one, whether the annotation is locked, and
 * `focusSave()` to hand focus to the save button once a code is chosen. The editor saves the codes with the text and
 * class, so the slot's control needs no save path of its own.
 * The slot also receives `stamp()`, which saves with `stamp: true` to ask the viewer to keep adding annotations like
 * this one wherever the reader clicks; the slot's control offers it where it fits its own layout.
 *
 * Edits left unsaved when the editor closes are kept as a draft and restored when it next opens on the same
 * annotation; opening it on another drops them ({@link keepAnnotationDraft}).
 */
import { Ref, defineComponent, ref } from "vue"
import { T } from "#i18n"
// Reimport to use as types.
import { Annotation } from "@epicurrents/core/types"
import { useStore } from "vuex"
import { useBiosignalContext } from "#config"
import { eventDisplayName } from "#app/views/biosignal/eventNames"
import {
    type AnnotationDraft,
    clearAnnotationDraft,
    keepAnnotationDraft,
    takeAnnotationDraft,
} from "#app/views/biosignal/annotationDraft"
import { PropType } from "vue"
import type { default as WaInput } from "@awesome.me/webawesome/dist/components/input/input.js"
import type { default as WaButton } from "@awesome.me/webawesome/dist/components/button/button.js"

/**
 * What `annotation` holds of what the editor edits.
 * @param annotation - The annotation.
 */
function storedValues (annotation: Annotation): AnnotationDraft {
    return {
        class: annotation.class,
        // An event created from a class template may carry its codes as an empty array.
        codes: Array.isArray(annotation.codes) ? {} : { ...annotation.codes },
        label: annotation.label,
    }
}

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
        const annotationCodes = ref<Record<string, number | string>>({})
        const annotationLabel = ref('')
        const closeTimeout = ref(0)
        const input = ref<WaInput>() as Ref<WaInput>
        const panel = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const saved = ref(false)
        const savebtn = ref<WaButton>() as Ref<WaButton>
        return {
            annotationClass,
            annotationCodes,
            annotationLabel,
            closeTimeout,
            input,
            panel,
            saved,
            savebtn,
            ...useBiosignalContext(store),
        }
    },
    watch: {
        annotation (next: Annotation, prev: Annotation) {
            // The editor stays open when another annotation takes its place, so the first one's edits are kept here.
            if (next.id !== prev.id) {
                this.keepDraft(prev)
                this.loadAnnotation(next)
            }
        },
    },
    computed: {
        icon (): string {
            return this.isLocked ? 'lock' : this.action === 'new' ? 'bookmark-plus' : 'pencil'
        },
        isLocked (): boolean {
            return this.action === 'edit' && this.annotation.locked
        },
        /** The name the annotation is shown by while its text is left blank. */
        labelPlaceholder (): string {
            return eventDisplayName(
                { class: this.annotationClass, codes: this.annotationCodes, label: '' },
                this.SETTINGS.annotations.classes,
                label => this.$t(label),
            ) || this.$t('Annotation text')
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
        /** Save, and ask the viewer to give the other events of the annotation's group the same codes. */
        applyToGroup () {
            this.submit({ applyToGroup: true })
        },
        /**
         * Focus the save button once the slot's control has re-rendered, so focus stays in the editor.
         */
        focusSave () {
            this.$nextTick(() => {
                this.savebtn?.focus()
            })
        },
        gotFocus () {
            if (this.closeTimeout) {
                window.clearTimeout(this.closeTimeout)
            }
        },
        handleButtonKeydown (event: KeyboardEvent) {
            if (event.key === 'Tab' && !event.shiftKey) {
                // Default navigation would jump to the next element, which resides outside of the editor
                // panel and would thus close it. We'll prevent that and instead make it jump back to the
                // fist element on the panel.
                event.preventDefault()
                this.input.focus()
            }
        },
        handleLabelKeydown (event: KeyboardEvent) {
            if (event.key === 'Tab' && event.shiftKey) {
                // Same as with the button, but now we jump to the last element.
                event.preventDefault()
                this.savebtn?.focus()
            }
        },
        handleLabelKeyup (event: KeyboardEvent) {
            if (event.key === 'Enter') {
                // Save the annotation on enter.
                this.save()
            }
        },
        handlePanelKeydown (event: KeyboardEvent) {
            // The panel itself has focus after a click on a part that takes none, and Tab from there would leave it:
            // forwards to the first field, backwards to the save button, as from the panel's ends.
            if (event.key !== 'Tab' || event.target !== event.currentTarget) {
                return
            }
            event.preventDefault()
            if (event.shiftKey) {
                this.savebtn?.focus()
            } else {
                this.input.focus()
            }
        },
        /**
         * Keep the unsaved edits of `annotation` as a draft, unless they were saved.
         * @param annotation - The annotation the editor was open on.
         */
        keepDraft (annotation: Annotation) {
            if (this.saved || (this.action === 'edit' && annotation.locked)) {
                return
            }
            keepAnnotationDraft(
                annotation.id,
                { class: this.annotationClass, codes: this.annotationCodes, label: this.annotationLabel },
                storedValues(annotation),
            )
        },
        /**
         * Show `annotation`, with its draft when one is kept for it.
         * @param annotation - The annotation to edit.
         */
        loadAnnotation (annotation: Annotation) {
            const values = takeAnnotationDraft(annotation.id) ?? storedValues(annotation)
            this.annotationClass = values.class
            this.annotationCodes = values.codes
            this.annotationLabel = values.label
            this.saved = false
        },
        lostFocus () {
            // Not the most elegant solution, but it handles accessibility nicely.
            this.closeTimeout = window.setTimeout(() => {
                this.$emit('exit')
            }, 100)
        },
        save () {
            this.submit()
        },
        /**
         * Set the code of `standard`, or remove it with `null`.
         * @param standard - Standard the code follows, such as `hed`.
         * @param value - The code, or `null` to remove it.
         */
        setCode (standard: string, value: number | string | null) {
            const codes = { ...this.annotationCodes }
            if (value === null) {
                delete codes[standard]
            } else {
                codes[standard] = value
            }
            this.annotationCodes = codes
        },
        /** Save, and ask the viewer to stamp copies of the annotation. */
        stamp () {
            this.submit({ stamp: true })
        },
        /**
         * Save the edits.
         * @param options - What the viewer does after saving: `applyToGroup` gives the other events of the annotation's
         *                  group the same codes, and `stamp` goes on stamping copies of it.
         */
        submit (options: { applyToGroup?: boolean, stamp?: boolean } = {}) {
            this.saved = true
            clearAnnotationDraft()
            this.$emit('save', {
                applyToGroup: !!options.applyToGroup,
                class: this.annotationClass,
                codes: { ...this.annotationCodes },
                label: this.annotationLabel,
                stamp: !!options.stamp,
            })
        },
        updateClass (newClass: string) {
            this.annotationClass = newClass as typeof this.annotationClass
        },
        updateLabel (newLabel: string) {
            this.annotationLabel = newLabel
        }
    },
    beforeMount () {
        this.loadAnnotation(this.annotation)
        // Add component styles to shadow root
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    beforeUnmount () {
        this.keepDraft(this.annotation)
    },
    mounted () {
        if (this.isLocked) {
            // Every field is disabled and takes no focus, so the panel holds it, and closes once it moves elsewhere.
            this.panel?.focus()
            return
        }
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
    padding: 1rem;
    pointer-events: none;
    z-index: 3;
}
.editor {
    display: flex;
    flex-wrap: wrap;
    font-size: 0.875rem;
    width: 100%;
    max-width: 40rem;
    min-width: 20rem;
    padding: 0.5rem;
    margin: auto;
    background-color: var(--epicv-background-hover);
    border: solid 1px var(--epicv-border);
    border-radius: 0.25rem;
    pointer-events: initial;
}
    .editor:focus {
        outline: none;
    }
    .editor .icon {
        /* The width a viewer's code control indents its own rows by, so their fields line up with this one. */
        flex: 0 0 1.25rem;
        width: 1.25rem;
        font-size: 1rem;
        margin: auto 0.5rem auto 0.25rem;
        color: var(--epicv-icon-default);
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
    .editor .codes {
        flex: 0 0 100%;
        order: 1;
    }
</style>
