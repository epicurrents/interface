/**
 * The biosignal viewers' channel layout settings, and their conversion into the core layout config a montage takes.
 *
 * Viewers convert their settings with `channelLayoutFromSettings` before calling `setChannelLayout`. A component's
 * `SETTINGS` is the two-source Proxy from `useContext`, which answers property reads but lists no keys, so spreading
 * it gives an empty object and every layout field silently falls back to the core default.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { ConfigChannelLayout } from '@epicurrents/core/types'
import type { ChannelLayoutSettings } from '#types/config'

/**
 * How each layout setting maps onto the core config. A record over every key of `ChannelLayoutSettings`, so a setting
 * added to the type without a mapping here fails the type check instead of being dropped on the way to the montage.
 */
const LAYOUT_MAPPING: {
    [K in keyof ChannelLayoutSettings]: (settings: ChannelLayoutSettings) => ConfigChannelLayout
} = {
    channelSpacing: (settings) => ({ channelSpacing: settings.channelSpacing }),
    groupGap: (settings) => ({ groupSpacing: settings.channelSpacing + settings.groupGap }),
    yPadding: (settings) => ({ yPadding: settings.yPadding }),
}

/** Names of the channel layout settings, without the module scope. */
export const CHANNEL_LAYOUT_SETTINGS = Object.keys(LAYOUT_MAPPING) as (keyof ChannelLayoutSettings)[]

/**
 * Build the core layout config from a viewer's settings. A value that is not a finite number is left out, so the core
 * default applies to it rather than a `NaN` collapsing the whole layout.
 * @param settings - The viewer's settings, or anything carrying the layout fields; read by property, never enumerated.
 * @returns Layout config for `setChannelLayout`, without `layout`, so each montage keeps its own channel groups.
 */
export const channelLayoutFromSettings = (settings: ChannelLayoutSettings): ConfigChannelLayout => {
    const config = {} as ConfigChannelLayout
    for (const key of CHANNEL_LAYOUT_SETTINGS) {
        for (const [field, value] of Object.entries(LAYOUT_MAPPING[key](settings))) {
            if (typeof value === 'number' && Number.isFinite(value)) {
                Object.assign(config, { [field]: value })
            }
        }
    }
    return config
}

/**
 * Whether a changed settings field is one of the channel layout settings of the given module.
 * @param field - Full settings path of the changed field, e.g. `eeg.groupGap`.
 * @param scope - Module scope of the viewer, e.g. `eeg`.
 */
export const isChannelLayoutSetting = (field: string, scope: string) => {
    return CHANNEL_LAYOUT_SETTINGS.some(key => field === `${scope}.${key}`)
}
