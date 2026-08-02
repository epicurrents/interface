/**
 * Module augmentation merging the interface's `announce` callback into the core-owned `EpicurrentsGlobal`, so
 * the single ambient `Window.__EPICURRENTS__` that `@epicurrents/core` declares carries both the core handles
 * and the interface's fields, with no competing declaration to collide.
 *
 * This augmentation silently no-ops the merge under several conditions, so keep this file minimal and isolated:
 * no `declare global` block (it does not coexist with a `declare module` augmentation); no `EpicurrentsGlobal`
 * name in scope (a local type or an import of that name shadows the interface below); and no import of the
 * augmented module `@epicurrents/core/types`, directly or transitively (importing from `./epicurrents-global`
 * pulls the barrel in). That last constraint is why `announce` is inlined here rather than reused from
 * `InterfaceGlobalAdditions` in ./epicurrents-global — keep the two signatures in sync.
 *
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

export {}

declare module '@epicurrents/core/types' {
    interface EpicurrentsGlobal {
        announce?: (
            message: string | string[],
            variant: 'brand' | 'success' | 'neutral' | 'warning' | 'danger',
        ) => void
    }
}
