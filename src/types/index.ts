/**
 * Public type surface of the interface package, re-exported as `@epicurrents/interface/types`.
 *
 * A consumer that only needs to name a type — a host typing its own setup file, a project typing a
 * viewer configuration — imports from here rather than reaching into a file path, which keeps the
 * internal layout free to move. Values live on the package's main entry; this module exports types
 * only, so importing it adds nothing to a bundle.
 *
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

export type * from './config'
export type * from './globals'
export type * from './interface'
export type * from './plot'
