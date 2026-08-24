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
4. **Settings writes and their persistence** — `set-settings-value` resolves which of the two settings trees owns a field, mirrors user-definable fields into session and local storage, and queues them for the user-settings backend when the host configured one. `AppStore` additionally owns reading the account copy at startup and applying it over the device copy.
5. **Registries** — the `MODULES` and `SERVICES` maps and the three component getters.
6. **Per-module runtime objects and their action sets** — eight module index files, around sixty action names.

### Staging

Ordered by how much store coupling each stage dissolves, not by module. Each stage stands alone and leaves the interface working.

**1. Settings subscriptions off the store.** Landed; the stages below assume it. See [useContext](AGENTS.md#usecontextstore-context--the-universal-composable) for the mechanism they build on.

**2. Property-owner registry and `setPropertyValue`.** The interface half has landed: each module declares the properties it owns, one setter validates and announces every write, and `useContext` reads and watches them by the same name it uses for a settings field ([Module properties](AGENTS.md#module-properties--the-two-owners-behind-one-setter)). What remains is the core half.

- **The core modules are still if-chains.** Each one maps a property name to a resource setter in a hand-written `else if` ladder, and a name that matches nothing falls off the end without a word — so a typo in a property name is silent at both owners. Converting those to registries closes that and gives the chained setter something to report against.
- **Threading `source` needs that conversion first.** `RuntimeResourceModule.setPropertyValue` takes `state` as its fourth argument, so there is nowhere to put a change context without changing every core module. Until then a module property cannot say whether a user made the change, which settings already can.
- **Resource targeting is declared but unexercised.** `setModulePropertyValue` resolves the module's own active resource when no target is given, and no caller passes one.
- The read side is only half collapsed. `addPropertyChangeHandler` now resolves a module property or a settings field in either tree, but resource properties still go through `RESOURCE.onPropertyChange` under the asset's own scope. Folding that in is what finally leaves one watch mechanism.

**3. Module action sets to the bus.** These are deleted rather than ported, which is why the shared boilerplate across the eight module index files should not be factored first — abstracting it would entrench the `'<code>.set-*'` name strings the bus replaces. What should be collapsed is the eight `use<X>Context` wrappers, into one generic `useModuleContext<Resource, Settings>(store, scope, component)`: they are where the Vuex coupling lives, and everything else in them is store-agnostic. Give it a signature that can become `useEegStore()` without a rename.

Fold the rest of the per-module duplication into this stage rather than sweeping eight files twice — the identical `DefaultFooter` getter, the all-empty `resourceLifecycleHooks`, the `setPropertyValue` warning stub, and `applyConfiguration`'s `moduleName` handling. Each pairs with making that member optional on `InterfaceResourceModule`.

**4. Remaining broadcasts.** The empty-bodied actions and mutations, undo/redo, fullscreen and overlay signalling. The bus is ready for all of them under `EventScopes.INTERFACE`; they need event names, and the phase semantics need stating explicitly, because Vuex's `subscribeAction(handler)` shorthand means `before` and at least one subscriber depends on the `after` form ([subscribeAction defaults to before](AGENTS.md#vuex-subscribeactionhandler-defaults-to-before)).

Settings persistence rides along here, and it is the part to move carefully. Device storage and the account mirror both hang off the `set-settings-value` mutation body, so both leave the store when it does. Once they listen for a change event instead, they see every write — including the fifty or so a startup restore produces — and a mirror that writes back what it has just read is worse than a wasted request, because the account copy is shared across the user's machines. The `source` flag from stage 2 is the guard, so persistence must not move before it exists.

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

A census of dispatch and subscription sites turned up several dead paths, since each one otherwise looks like a channel that has to keep working. The dispatch side is now closed: the unprefixed calls are gone, and [tests/store-vocabulary.test.ts](tests/store-vocabulary.test.ts) scans every literal `dispatch` against the declared action names so another one cannot land silently. What remains:

- **No equivalent guard on the subscriber side.** A `store.subscribe` that matches a mutation type nothing commits is inert in the same way, and that is how the `set-label-value` and unprefixed `set-page-number` subscribers survived — the latter also leaking a subscription per mount, because `mounted` overwrote its unsubscriber. Scanning for it is harder than the dispatch case: a subscriber legitimately matches names declared anywhere, including in a host application.
- The `getSettingsValue` getter has no call sites, and neither do `getSettingForInput` / `getInputForSetting` — which also carry an inverted user-definable check, dormant only because the field names they compare live in different key spaces (menu paths are module-prefixed, `_userDefinable` keys are not).
- The `action:` scope in a control's `reloadOn` list now has no users. Only `OnOffControl` ever implemented it; `ButtonControl` and `DropdownControl` silently ignored the entry. Removing the branch belongs with stage 3, since it is the same `subscribeAction` teardown.
