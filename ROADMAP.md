# @epicurrents/interface — roadmap

General design directions and work deferred from previous implementations. Nothing here describes shipped behaviour — [README.md](README.md) is the current-state description of the package, and [AGENTS.md](AGENTS.md) the in-depth technical reference; each item below links to the section there whose current state it builds on.

**This is not an issue tracker.** Bugs, feature requests and other discrete work items belong in the GitHub issue tracker. This file holds only broad design intent that is not yet actionable as an issue, and it will likely be retired in favour of the external tracker once that practice is established.

## Vuex → Pinia, with a unified property mutator

The interface holds one large Vuex store ([Vuex Store](AGENTS.md#vuex-store-srcstoreindexts)) that serves six unrelated purposes at once. The end state is per-module Pinia stores holding interface state only, with the traffic the store currently carries moving to the event bus, and a single property mutator that hides which layer owns a given property.

This has been deferred several times, and the reason is that "move the store" is the smallest part of the work. Most of what the store does today is not state.

### The boundary

The Vuex state **is** the core `RuntimeStateManager` instance — `createStore()` receives it directly, and `AppStore`'s constructor assigns thirteen interface properties onto `runtime.APP`. Frontend and backend state are one object graph with two owners, and Vue's reactivity currently wraps all of it.

That constructor assignment is the migration boundary, and it is already a clean line:

| Owner | Fields on `APP` |
|---|---|
| Interface — moves to Pinia | `activeScope`, `activeModality`, `componentStyles`, `containerId`, `hasRedoableAction`, `hasUndoableAction`, `isFullscreen`, `plots`, `settingsOpen`, `shadowRoot`, `showOverlay`, `uiComponentVisible`, `view` |
| Core — stays in the state manager | `activeDataset`, `connectors`, `datasets`, `id`, `moduleName`, `runningId`, `studyExporters`, `studyImporters`, `studyLoadProtocols` |

### What the store does, by category

Only the first of these is what a store is for:

1. **Interface state** — the thirteen fields above.
2. **Pass-through to the state manager** — `add-connector`, `add-resource`, `remove-connector`, `set-active-dataset`, `set-active-resource` forward and nothing else.
3. **Broadcast channel** — around a dozen actions and mutations with empty bodies, existing so components can subscribe ([Store actions vocabulary](AGENTS.md#store-actions-vocabulary), [Store mutations vocabulary](AGENTS.md#store-mutations-vocabulary)).
4. **Settings writes and their persistence** — `set-settings-value` resolves which of the two settings trees owns a field, then mirrors user-definable fields into session and local storage.
5. **Registries** — the `MODULES` and `SERVICES` maps and the three component getters.
6. **Per-module runtime objects and their action sets** — eight module index files, around sixty action names.

### Staging

Ordered by how much store coupling each stage dissolves, not by module. Each stage stands alone and leaves the interface working.

**1. Settings subscriptions off the store.** `set-settings-value` is the single busiest thing in the store: it accounts for roughly a third of all `store.subscribe` call sites. Both replacements already exist — `INTERFACE.setFieldValue` dispatches `InterfaceEvents.SETTING_CHANGED` on the bus, and `useContext` exposes `addPropertyChangeHandler` / `removePropertyChangeHandlers` resolving across both settings trees ([useContext](AGENTS.md#usecontextstore-context--the-universal-composable)). Only the subscribers need rewriting, and no new machinery is involved, so this stage proves the settings-watch path at scale before any state moves.

**2. Property-owner registry and `setPropertyValue`.** The pain point is that a caller has to know whether a property lives in the application runtime or in the store before it can mutate it. The mutator hides that the way `setFieldValue` already hides which settings tree owns a field.

- Resolution is an explicit `name → owner` registry per module, not a fallback chain. Settings paths are effectively unique, so interface-first-then-core works for them; property names are not — `sensitivity` and `timebase` exist on both resource and montage, `trendVisible` on the module runtime, `viewStart` on the resource. An unregistered name warns rather than silently landing somewhere.
- Properties are per-resource where settings are singletons. `RuntimeResourceModule.setPropertyValue` already carries an optional `resource` argument; default it to the active resource, as `useContext`'s `RESOURCE` does.
- The read side is what pays for the registry. A component today picks between three watch mechanisms depending on where the value lives: `RESOURCE.onPropertyChange`, `addPropertyChangeHandler`, and `store.subscribe`. One write entry point can emit one uniform change notification regardless of owner, collapsing those into a single `onPropertyChange(path, handler)`.

**3. Module action sets to the bus.** These are deleted rather than ported, which is why the shared boilerplate across the eight module index files should not be factored first — abstracting it would entrench the `'<code>.set-*'` name strings the bus replaces. What should be collapsed is the eight `use<X>Context` wrappers, into one generic `useModuleContext<Resource, Settings>(store, scope, component)`: they are where the Vuex coupling lives, and everything else in them is store-agnostic. Give it a signature that can become `useEegStore()` without a rename.

Fold the rest of the per-module duplication into this stage rather than sweeping eight files twice — the identical `DefaultFooter` getter, the all-empty `resourceLifecycleHooks`, the `setPropertyValue` warning stub, and `applyConfiguration`'s `moduleName` handling. Each pairs with making that member optional on `InterfaceResourceModule`.

**4. Remaining broadcasts.** The empty-bodied actions and mutations, undo/redo, fullscreen and overlay signalling. The bus is ready for all of them under `EventScopes.INTERFACE`; they need event names, and the phase semantics need stating explicitly, because Vuex's `subscribeAction(handler)` shorthand means `before` and at least one subscriber depends on the `after` form ([subscribeAction defaults to before](AGENTS.md#vuex-subscribeactionhandler-defaults-to-before)).

**5. Move the state.** Only after 1–4 does the remaining store fit in a per-module Pinia store. The registries in category 5 are lookup tables rather than state and can leave the store at any point.

This is the smallest stage, because the reactivity boundary turns out to coincide with the ownership boundary. Across the whole interface there are 31 reactive reads of `state.APP` — 23 template bindings and 8 in computed properties — spread over `App.vue`, `AppMenubar.vue`, the four view components and `DatasetDialog.vue`. Every one of them reads an interface-owned field, and only four fields are involved: `view`, `uiComponentVisible`, `activeModality` and `isFullscreen`. The other nine interface-owned fields are read only from methods and lifecycle hooks, and core-owned fields are not read reactively anywhere (see [Core runtime mutations do not trigger Vue reactivity](AGENTS.md#core-runtime-mutations-do-not-trigger-vue-reactivity)). Standing up a store for those four fields and rewriting 31 reads is a bounded change in seven files.

### Module shape

A `createResourceModule(spec)` factory rather than a class base. `runtime` is a plain object the action handlers close over directly, and it is cast to `InterfaceResourceModule` rather than typed by it — those casts are what let the untyped `setPropertyValue` through in the first place.

### Constraints that must survive

- **Action name strings are public API.** Components and the host application dispatch `'eeg.set-trend-visible'` and friends by string. Anything generated has to produce byte-identical keys, and that is worth a test asserting the key set per module.
- **Edition trimming depends on per-module static imports.** `setup/registry.ts` and the `epi-trim-registry` plugin in the builder drop unused registrars, and rollup has to resolve a static import before it can tree-shake what the import provides. A factory must therefore take component loaders as arguments and never import them, or every edition pulls in every module's components.
- **`useContext`'s `RESOURCE` is deliberately not reactive.** It is resolved once at `setup()` and stays pointing at that resource for the component's lifetime. Components rely on this: stripping listeners from the outgoing resource, or inspecting its state before fetching from the new one, requires a reference that does not change underfoot. A migration that makes the active resource a reactive ref breaks those teardown paths silently, so the one-shot resolution has to be preserved even where surrounding state becomes reactive.
- **`set-active-resource` carries load-bearing ordering.** The action awaits `disableAllOtherResources`, which blocks on `awaitDeactivation` so a new recording cannot allocate while a previous resource is still rearranging the shared buffer. It then resolves and switches the application view before committing. This is application behaviour parked in an action; wherever it lands, the await has to come with it.

### Open questions

**`load-study-*` is an RPC, not an event.** The action mints a promise, ships `{ resolve, reject }` through the mutation payload, and `DefaultInterface` resolves it from its subscriber. The bus has phases and cancellation but no reply channel. Either it grows a request/response helper, or these three stop being messages and become direct `epicApp.loadStudy()` calls — the interface already holds the application reference, and the indirection buys nothing once the store is not the thing being decoupled from.

### Prerequisite cleanup

A census of dispatch and subscription sites turned up several dead paths. They should be resolved as issues before the migration rather than carried through it, since each one otherwise looks like a channel that has to keep working:

- `BiosignalInterface.vue` dispatches `set-cursor-tool` and `set-open-drawer` unprefixed from live template handlers; no such actions exist, only the module-scoped variants.
- Three subscriber matches have no dispatcher: `eeg.set-spectrogram-mode`, `set-label-value`, and an unprefixed `set-page-number` where only the `pdf.` and `htm.` variants exist.
- The `getSettingsValue` getter has no call sites.
- The ONNX mutations are commented out while the actions still commit to them.
