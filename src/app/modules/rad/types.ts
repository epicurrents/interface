/**
 * Radiology types.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { InterfaceSchema } from '#types/interface'
import type { DataResource, SafeObject } from '@epicurrents/core/types'

export type RadiologyInterfaceSchema = InterfaceSchema

export type RadiologyInterfaceSettings = SafeObject & {
}

export type RadiologyModuleSettings = SafeObject & {
}

export type RadiologyResource = DataResource & {
}
