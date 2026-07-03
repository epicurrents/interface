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
    /**
     * The focused epoch of a centered (semi-epoch) biosignal view changed; detail carries
     * `{ resourceId, epochNumber, epochStart, epochLength }`, with a null `epochNumber` when the
     * view is not in centered epoch display. The epoch index cannot be derived downstream from the
     * view start (adjacent epochs clamp to the same start at the recording edges), so it is pushed.
     */
    EPOCH_CHANGED = 'epoch-changed',
    /** A request for the current focused epoch; the biosignal view answers with `EPOCH_CHANGED`. */
    REQUEST_EPOCH = 'request-epoch',
    /** Command to step the focused epoch; detail carries `{ direction: 'forward' | 'backward' }`. */
    STEP_EPOCH = 'step-epoch',
    /** An interface settings field changed value; detail carries the dotted field path. */
    SETTING_CHANGED = 'setting-changed',
}
