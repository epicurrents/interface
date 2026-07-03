/**
 * Interface event types.
 * @package    epicurrents/interface
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

/**
 * Names of events emitted under the interface event scope (`EventScopes.INTERFACE`).
 */
export enum InterfaceEvents {
    /** An interface settings field changed value; detail carries the dotted field path. */
    SETTING_CHANGED = 'setting-changed',
}
