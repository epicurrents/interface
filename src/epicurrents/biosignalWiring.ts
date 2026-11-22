/**
 * Wiring of biosignal resources to the Python interpreter.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { toRaw } from "vue"
import type { BiosignalResource } from "@epicurrents/core/types"
import type { PythonInterpreterService, RunCodeResult } from "@epicurrents/pyodide-service/types"

/**
 * Create the function that wires a biosignal resource to the interpreter, once per resource.
 *
 * Only a consumer that computes the montage in Python needs the interpreter before the resource can be shown;
 * `usePyodideBiosignal` is how it says so. Otherwise the service is registered for the analysis tools alone, and they
 * await it themselves through `runCode`, which resolves `initialSetup` and its script dependencies before running
 * anything. Adding the dependencies regardless would hold every recording closed behind an interpreter download and a
 * package install for a capability the session may never open: the resource is not ready until `dependenciesMissing`
 * is empty, and its view shows the loading state until it is.
 *
 * A resource counts as wired only once its dependencies were added, so one activated before the interpreter service
 * is registered is wired on a later activation. The same resource reaches the function both as the object itself and
 * as a reactive proxy of it, so it is recognised by the object behind the proxy: adding the dependencies a second
 * time would take a ready resource back to not ready.
 * @param usePyodideBiosignal - Whether biosignal resources compute their montages in the interpreter.
 * @returns A function wiring the resource it is given, true if this call wired it.
 */
export const createBiosignalWiring = (usePyodideBiosignal: boolean) => {
    const wiredResources = new WeakSet<object>()
    return (resource: BiosignalResource) => {
        const key = toRaw(resource)
        if (wiredResources.has(key)) {
            return false
        }
        const runtime = window.__EPICURRENTS__.RUNTIME!
        const pyodide = runtime.SERVICES.get('pyodide') as unknown as PythonInterpreterService | null
        if (
            !pyodide || !usePyodideBiosignal || !runtime.SETTINGS.app.useMemoryManager
            || !Object.hasOwn(key, '_signalCacheStatus')
        ) {
            return false
        }
        wiredResources.add(key)
        // Refresh of the Pyodide-side input arrays is demand-driven inside `biosignal_get_signals` (and the batched
        // `biosignal_refresh_channels` primitive), so no per-signalCacheStatus push is needed here.
        // Add the core and biosignal scripts as dependencies for biosignal resources.
        resource.addDependencies('pyodide-core', 'pyodide-biosignal')
        pyodide.initialSetup.then(async (setupResult) => {
            if (setupResult) {
                resource.setDependenciesReady('pyodide-core')
                const scriptResult = await pyodide.loadDefaultScript('biosignal') as RunCodeResult
                if (scriptResult.success) {
                    resource.setDependenciesReady('pyodide-biosignal')
                } else {
                    resource.errorReason = 'Pyodide script error'
                    resource.state = 'error'
                }
            } else {
                resource.errorReason = 'Failed to load Pyodide'
                resource.state = 'error'
            }
        })
        return true
    }
}
