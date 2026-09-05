/**
 * Ambient declaration for single-file components, so a build that does not parse `.vue` itself
 * still resolves component imports.
 *
 * It must live in a file with no top-level import or export: those make the file a module, and an
 * ambient module declaration inside a module is an augmentation of an existing module rather than
 * a wildcard declaration, so it silently applies to nothing. `vue-tsc` parses components properly
 * and never consults this; the declaration build (plain `tsc`, see scripts/build-types.mjs) relies
 * on it, and gets the same generic component type a consumer sees.
 *
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

declare module '*.vue' {
    const Component: import('vue').DefineComponent
    export default Component
}
