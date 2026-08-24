/**
 * Tests asserting that every settings path named by a module's settings menu, and every field listed in its
 * `_userDefinable` map, resolves to an actual field in that module's settings.
 *
 * A module's settings are the union of two trees: the interface config in this package and the core module
 * package's own config. `useContext` joins them behind one proxy, so a menu field may legitimately name a
 * field in either one, and a path that exists in neither is inert — the control moves and nothing happens.
 *
 * The four biosignal modules are the whole population: no other module declares a settings menu. The app
 * module is left out because its core half lives in `core/src/config/Settings.ts`, whose own `#`-subpath
 * imports collide with this package's alias map. The same collision is why the core module configs imported
 * below must keep their `#` imports type-only; a runtime one would resolve against this package instead.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { describe, expect, test } from 'vitest'
import { schemas as accSchemas, settings as accSettings } from '#app/modules/acc/config'
import { schemas as eegSchemas, settings as eegSettings } from '#app/modules/eeg/config'
import { schemas as emgSchemas, settings as emgSettings } from '#app/modules/emg/config'
import { schemas as ncsSchemas, settings as ncsSettings } from '#app/modules/ncs/config'
import accModuleSettings from '#workspace/epicurrents/acc-module/src/config'
import eegModuleSettings from '#workspace/epicurrents/eeg-module/src/config'
import emgModuleSettings from '#workspace/epicurrents/emg-module/src/config'
import ncsModuleSettings from '#workspace/epicurrents/ncs-module/src/config'
import type { InterfaceModuleSchema } from '#types/config'

type SettingsObject = { [field: string]: unknown }

const asObject = (settings: unknown) => settings as unknown as SettingsObject

const MODULES: [string, InterfaceModuleSchema, SettingsObject, SettingsObject][] = [
    ['acc', accSchemas, asObject(accSettings), asObject(accModuleSettings)],
    ['eeg', eegSchemas, asObject(eegSettings), asObject(eegModuleSettings)],
    ['emg', emgSchemas, asObject(emgSettings), asObject(emgModuleSettings)],
    ['ncs', ncsSchemas, asObject(ncsSettings), asObject(ncsModuleSettings)],
]

/**
 * Walk a dot-delimited `path` through `root`, returning true when every segment exists.
 */
const resolvesIn = (root: SettingsObject, path: string): boolean => {
    let cursor: unknown = root
    for (const segment of path.split('.')) {
        if (
            cursor === null || typeof cursor !== 'object'
            || !Object.prototype.hasOwnProperty.call(cursor, segment)
        ) {
            return false
        }
        cursor = (cursor as SettingsObject)[segment]
    }
    return true
}

/**
 * Collect every settings path named by the module's menu, from plain input fields and from the preset lists
 * that write several fields at once.
 */
const menuPaths = (schemas: InterfaceModuleSchema): string[] => {
    const paths = [] as string[]
    for (const field of (schemas.settings?.fields || []) as { setting?: string, presets?: { setting: string }[] }[]) {
        if (field.setting) {
            paths.push(field.setting)
        }
        for (const preset of field.presets || []) {
            paths.push(preset.setting)
        }
    }
    return paths
}

describe.each(MODULES)('%s module settings paths', (code, schemas, interfaceSettings, moduleSettings) => {
    const resolves = (path: string) => resolvesIn(interfaceSettings, path) || resolvesIn(moduleSettings, path)

    test('every menu field names a setting that exists', () => {
        const unresolved = [] as string[]
        for (const path of menuPaths(schemas)) {
            if (!path.startsWith(`${code}.`)) {
                unresolved.push(`${path} (wrong module prefix)`)
                continue
            }
            if (!resolves(path.slice(code.length + 1))) {
                unresolved.push(path)
            }
        }
        expect(unresolved).toEqual([])
    })

    test('every user-definable field names a setting that exists', () => {
        const unresolved = Object.keys(interfaceSettings._userDefinable as SettingsObject).filter(f => !resolves(f))
        expect(unresolved).toEqual([])
    })
})
