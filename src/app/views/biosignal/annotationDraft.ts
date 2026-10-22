/**
 * The unsaved edits of an annotation, kept when the annotation editor closes without saving, so a reader who closed it
 * by accident reopens the same annotation and carries on where they were.
 *
 * One draft is kept at a time. Opening the editor on another annotation drops it, so unsaved edits never linger past
 * the next edit, and saving drops it too. A draft lives in the page only and is lost on reload.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

/** What the editor edits of an annotation. */
export type AnnotationDraft = {
    class: string
    codes: Record<string, number | string>
    label: string
}

let _draft: (AnnotationDraft & { id: string }) | null = null

/**
 * Drop the kept draft, if any.
 */
export function clearAnnotationDraft () {
    _draft = null
}

/**
 * Keep `edited` as the draft of annotation `id`, unless it is what the annotation already holds, in which case there
 * is nothing to keep and any draft is dropped.
 * @param id - The annotation's id.
 * @param edited - The editor's state.
 * @param stored - The annotation's saved values.
 */
export function keepAnnotationDraft (id: string, edited: AnnotationDraft, stored: AnnotationDraft) {
    _draft = sameDraft(edited, stored)
           ? null
           : { class: edited.class, codes: { ...edited.codes }, id, label: edited.label }
}

/**
 * The draft of annotation `id`, or `null` when none is kept for it. Asking for another annotation's draft drops the
 * kept one, since the editor is now open on something else.
 * @param id - The annotation's id.
 */
export function takeAnnotationDraft (id: string): AnnotationDraft | null {
    if (!_draft || _draft.id !== id) {
        _draft = null
        return null
    }
    return { class: _draft.class, codes: { ..._draft.codes }, label: _draft.label }
}

/**
 * Whether two states hold the same class, label and codes.
 */
function sameDraft (a: AnnotationDraft, b: AnnotationDraft) {
    const codes = Object.entries(a.codes)
    return a.class === b.class && a.label === b.label && codes.length === Object.keys(b.codes).length
        && codes.every(([standard, value]) => b.codes[standard] === value)
}
