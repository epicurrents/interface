# @epicurrents/interface — architecture notes for AI coding assistants

This package is the Epicurrents viewer user interface: a Vue 3 + Vuex application that implements the `InterfaceModule` contract from `@epicurrents/core`. It builds either as a standalone app or as an embeddable library that a host page mounts into a container element. It owns no signal processing of its own — it renders whatever modality modules the consumer registered with the core application, resolving each resource's viewer, controls and footer components through the module registry at runtime.

All signal rendering goes through WebGL (`WebGlPlot`), and the Vuex state *is* the core `RuntimeStateManager` instance, so Vue reactivity and the core runtime observe the same object — though only reads are shared, since core writes bypass the reactive proxy (see [Core runtime mutations do not trigger Vue reactivity](#core-runtime-mutations-do-not-trigger-vue-reactivity)).

[README.md](README.md) is the user-facing description (structure, usage, build workflow); [ROADMAP.md](ROADMAP.md) carries design intent rather than current state, and the store described below is being migrated to Pinia along the staging set out there.

---

## Package layout

```
src/
  DefaultInterface.ts     # implements InterfaceModule — root Vue app entry
  app/
    App.vue               # root component
    AppMenubar.vue        # top menu
    icons.ts              # icon registry (see "Adding icons" below)
    modules/              # per-modality UI (acc/, doc/, eeg/, emg/, ncs/, pdf/, rad/, tab/)
      eeg/
        components/       # EegViewer, EegPlot, EegControls, EegNavigator, EegTrend, etc.
          tools/          # PowerSpectrumTool, TopomapTool, SignalCursorTool, etc.
          overlays/       # EegAnalysisTools, EegChannelProperties
      …
    views/
      SplitPanelView.vue  # wrapper around wa-split-panel
      biosignal/          # BiosignalInterface, annotation overlays, axis plots, sidebar
      media/              # MediaInterface (audio/video)
      radiology/          # RadiologyInterface (OHIF wrapper)
      default/            # DefaultInterface fallback
    navigator/            # DatasetNavigator, DatasetSelector
    overlays/             # ConnectorDialog, DatasetDialog, WelcomeDialog, WindowDialog, etc.
    settings/             # SettingsDialog + individual control components
    footers/              # AppFooter, SystemFooter, FooterMenu
    controls/             # ButtonControl, DropdownControl, OnOffControl (toolbar)
  components/
    plots/biosignal/      # CanvasPlot, WebGlPlot — hardware-accelerated signal rendering
    report/               # DynamicReportForm, FormParser, SchemaManager (structured reporting)
  store/                  # Vuex store: index, actions, mutations
  i18n/                   # English + Finnish translations
  config/                 # interface-level settings defaults
  setups/                 # entry setups — standalone.ts (standalone entry), full.example.ts (all-in reference), index.ts
  epicurrents/
    EpicurrentsPlugin.ts  # Vue plugin that wires the app to the core runtime
```

Signal rendering uses two strategies:
- `CanvasPlot` — 2D Canvas API fallback
- `WebGlPlot` / `WebGlPlotTrace` — WebGL hardware-accelerated (default)

---

## Adding icons to the interface

Every icon used in `src/` requires **three edits** to [src/app/icons.ts](src/app/icons.ts):
1. An SVG `import` from `@material-symbols/svg-400/outlined/`.
2. An entry in the `ICON_SVGS` lookup table.
3. An entry in `FA_TO_MATERIAL` mapping the FA kebab-case caller name to the Material snake_case name (only when they differ).

All three must be in alphabetical order within their respective blocks. Missing any one of them causes the icon to silently render nothing at runtime — there is no build-time or type-level check that catches an omission.

---

## Interface internals — DefaultInterface, store, rendering

### `DefaultInterface` (entry point)

Source: [src/DefaultInterface.ts](src/DefaultInterface.ts)

`DefaultInterface` is the `InterfaceModule` implementation that creates the Vue app, wires it to the core runtime, and manages lifecycle.

**Constructor sequence:**
1. Finds `#epicurrents<containerId>` container in the DOM
2. Optionally creates a **Shadow DOM** (`config.embedded = true`) to isolate styles from the host page; otherwise removes foreign page stylesheets
3. `createApp(VueApp)` → installs `EpicurrentsPlugin`, i18n, Vuex store, WebAwesome `v-property` directive
4. **Pyodide wiring**: listens on `add-resource` event bus event; for any `BiosignalResource` registers the `pyodide-core` and `pyodide-biosignal` dependencies and loads the `biosignal` script. Pyodide-side input arrays are refreshed lazily on demand from inside `biosignal_get_signals` / `biosignal_refresh_channels` — there is no per-`signalCacheStatus` push step
5. **Store subscriptions**: `load-study-folder` and `load-study-url` mutations delegate to `epicApp.loadStudy()`
6. **Fullscreen** tracking via `fullscreenchange` events → commits `set-fullscreen` to Vuex
7. Calls `loadModules(config.activeModules || [])` → for each module: fetches optional JSON config, calls `store.addModule()`. Resolves `awaitReady()` promise when all done
8. **Mounts Vue app** after `awaitReady()` + WebAwesome `allDefined()` both resolve (avoids fouc from unregistered web components)

### Vuex Store ([src/store/index.ts](src/store/index.ts))

**Key design**: The Vuex state **is** the `RuntimeStateManager` instance (the same object). No copying — the store holds a direct reference to the core runtime. This means Vue reactivity and the core runtime state are the same object, but the sharing is one-directional: core's own writes never reach the reactive proxy ([Core runtime mutations do not trigger Vue reactivity](#core-runtime-mutations-do-not-trigger-vue-reactivity)).

Interface-specific properties are added directly to `runtime.APP` via `Object.assign`:
- `activeScope`, `activeModality`, `componentStyles`, `containerId`, `plots` (Map of BiosignalPlot), `settingsOpen`, `shadowRoot`, `showOverlay`, `uiComponentVisible`, `view`

**Getters:**
| Getter | Returns |
|---|---|
| `getBiosignalPlot` | Lazily creates `new WebGlPlot()` on first call, stores in `APP.plots.get('biosignal')` |
| `getResourceViewer` | Returns `resourceMod.getViewerComponent` for the active resource's modality |
| `getResourceControls` | Same pattern for controls component |
| `getResourceFooter` | Same pattern for footer component |

**Module registration** (`addModule()`): injects the module's `actions` and `mutations` into the live Vuex store via `hotUpdate()`. This is how EEG/EMG/etc. module actions become available in the store without knowing about them at store construction time.

**Local settings persistence** (`loadLocalSettings()`): reads `sessionStorage` / `localStorage` key `'epicurrents'`, applies only fields declared in module `_userDefinable` with correct constructor type. Session storage wins over local storage (allows per-tab settings isolation).

### `App.vue` (root component)

**CSS grid layout:**
```
top: menubar (calc(1.5rem + 1px) tall)
bottom: [dataset-navigator split-panel | interface-view]
```

**Interface views** — loaded conditionally based on `config.activeViews`:
- `default-interface` — always present
- `biosignal-interface`, `media-interface`, `radiology-interface` — lazy-loaded only if in `activeViews`

**Browser check**: requires `window.chrome` (Chromium-only API). Shows an error page with a bypass link (`?override`) on other browsers.

**Callout (toast) system**: floating `wa-callout` elements, fade out after 5s, removed at 10s.

**Dialogs** tracked in `reactive(dialogs)`: connector, dataset, url, settings, reload, log, instructions.

**File loading**: hidden `<input type="file">` elements triggered programmatically. Falls back to `window.showOpenFilePicker()` if available (shows native OS picker with MIME/extension filter). All file loading goes through `$store.dispatch('load-study-url', ...)` or `load-study-folder`.

**Theme**: CSS custom properties (`--epicv-background`, `--epicv-text-main`, etc.) under `.epicv-dark-theme` and `.epicv-light-theme`. WebAwesome components get matching `wa-dark` / `wa-light` class.

### Component hierarchy (EEG modality)

```
App.vue
  ├── AppMenubar
  ├── DatasetNavigator (resizable panel, left)
  └── default-interface / biosignal-interface
        └── EegViewer.vue (manages layout and state)
              ├── PlotYAxis (channel labels column)
              ├── TimescaleGrid (horizontal time markers)
              ├── EegPlot.vue (WebGL canvas → primary rendering)
              ├── AnnotationLabels (event markers overlay)
              ├── VerticalCursors (time cursor overlays)
              ├── ContextMenu (right-click actions)
              ├── AnnotationEditor
              ├── EegAnalysisTools (PSD, topomap windows)
              ├── AnnotationSidebar (right panel)
              └── EegNavigator (overview strip at bottom)
```

### `EegViewer.vue` (state + layout orchestration)

- Two nested `SplitPanelView` panels:
  - **Outer** (vertical split): signal area (top, ~80%) + navigator strip (bottom)
  - **Inner** (horizontal split): plot+overlays (left) + annotation sidebar (right)
- Tracks: `visibleRange`, `viewRange`, `secPerPage`, `pxPerSecond`, `plotDimensions`
- `useEegContext(store)` provides reactive access to `RESOURCE`, `SETTINGS`, `MONTAGE` from the EEG module's Vuex context
- Analysis windows (`EegAnalysisTools`) are floating `WindowDialog` components opened on signal selection (right-click drag)

### `EegPlot.vue` — Signal → WebGL rendering

Source: [src/app/modules/eeg/components/EegPlot.vue](src/app/modules/eeg/components/EegPlot.vue)

**Signal data flow:**
1. `mounted()` hooks `RESOURCE.onPropertyChange('signalCacheStatus', checkCacheState)` to know when data is ready
2. Once `viewDataAvailable = true`, calls `drawPlot()`:
   - Gets `WebGlPlot` via `$store.getters.getBiosignalPlot()` (single shared plot instance)
   - Sets `pxPerSensRefUnit = screenPPI / 2.54` (px per cm, for μV/cm sensitivity display)
   - Calls `wglPlot.addTo(this.plot)` to mount canvas
3. `addTraces()`: iterates `RESOURCE.activeMontage.channels` (or raw channels), creates one `WebGlPlotTrace` per visible channel with color (laterality-aware: L=sin, R=dex, Z=mid), sensitivity, polarity, scale, baseline offset. Calls `wglPlot.addChannel(trace)`.
4. `updateTraces()`:
   - Calls `RESOURCE.getAllSignals([viewStart, viewStart + viewRange])`
   - Iterates signal response, calls `line.setData(response.signals[i].data, downSampleFactor)` per trace
   - Sets `newSignalData = true`
5. **Animation loop**: `requestAnimationFrame(newFrame)` — on each frame, if `newSignalData`, calls `wglPlot.update()` (uploads data to GPU, draws), sets `newSignalData = false`

**Property change triggers for re-render**: `RESOURCE.onPropertyChange(['filters', 'channels', 'sensitivity', 'viewStart'], updateTraces)`

**Downsampling**: if `samplingRate >= 2 × downsampleLimit × 2`, `downSampleFactor = floor(samplingRate / downsampleLimit)`. Only one sample per `downSampleFactor` samples is passed to the GPU buffer.

### `WebGlPlot.ts` — WebGL line renderer

Source: [src/components/plots/biosignal/WebGlPlot.ts](src/components/plots/biosignal/WebGlPlot.ts)

Custom implementation (inspired by [webgl-plot](https://github.com/danchitnis/webgl-plot)).

**Shaders:**
```glsl
// Vertex:
attribute vec2 coordinates;
uniform mat2 uScale;  // [1,0, 0,ampScale*polarity]
uniform vec2 uOffset; // [0, baseline*2-1]
void main() { gl_Position = vec4(uScale*coordinates + uOffset, 0.0, 1.0); }

// Fragment:
uniform highp vec4 uColor;
void main() { gl_FragColor = uColor; }
```

**Per-trace draw** (`_updateLines()`):
- `ampScale = 2 × 10^scale / (heightInSensRefUnits × sensitivity)` — maps physical amplitude to NDC
- `uOffset.y = baseline * 2 - 1` — positions channel vertically (NDC: -1 = bottom, 1 = top)
- `gl.bufferData(ARRAY_BUFFER, line.xy, STREAM_DRAW)` — uploads interleaved [x, y] pairs
- `gl.drawArrays(LINE_STRIP, 0, length)` — draws as a connected line

**Blend mode**: `SRC_COLOR × DST_COLOR` (multiply) — overlapping traces from different channels darken each other naturally.

**Trace x-geometry is TIME-based, and must stay that way.** `WebGlPlotTrace.initData` positions each datapoint at its offset from the view start as a fraction of the view duration:

```ts
clipSpaceStep = 2*(downsampleFactor/samplingRate)/viewRange   // one sample period as a share of the view
```

Normalising over the datapoint count instead (`2/length`) is *equivalent* only when the points exactly span the view, and the residual is one sample period — 0.04 % of the width at 256 Hz over a 10 s view (invisible), but **10 % at 1 Hz**. A recording that mixes 256 Hz EEG with 1 Hz aEEG/CFM trends in one plot makes the low-rate case real: with count-normalisation a 1 Hz trend pins its last point at a fixed fraction of the width and *stretches* as the view widens, instead of gaining a sample. The trace falls back to count-normalisation when `viewRange` is not passed — `EmgPlot` / `NcsPlot` / `AccPlot` still do this, which is harmless only because their channels are uniformly high-rate. Pass `viewRange` if a low-rate channel can ever appear in those plots.

Two invariants ride along:

- **Allocate `ceil(viewRange*rate/downsampleFactor) + 1` points**, not `floor(...)`. A range `[t, t+d]` contains up to `floor(d*rate)+1` samples; rounding down silently truncates the last in-range sample. The `+1` holds the datapoint past the view edge — `initData` gives it its true x (> 1) and WebGL clips it, which is what lets a line reach the right edge.
- **`pointCount`, not `length`, is what gets drawn.** `setData` records how many datapoints actually hold data; `_updateLines` / `_drawSegmentedLine` draw only those. Drawing `length` would trail a filler line from the last real sample whenever the data is short (recording end, partial cache).

`EegPlot.edgePadding()` requests **one** sample period of the *slowest visible* channel past the view end. A half-open view holds no datapoint at its end, so reading one beyond it is what lets a line reach the right edge — legitimate renderer lookahead, not a workaround. The trace's own `ceil(...)+1` allocation drops the surplus, so it costs nothing. It is a method, not a computed — the visible channel set changes with the active montage, and `RESOURCE.channels` is not reliably reactive, so a computed would cache a stale value.

One period is only sufficient because `GenericSignalReader.getSignals` (in `@epicurrents/core`) returns `ceil(duration*samplingRate)` datapoints. It historically returned `Math.round(...)`, which drops the last datapoint whenever the range doesn't land on a sample boundary; with rounding, one period of lookahead leaves a gap at roughly half of all view widths.

**`getSignals` count contract.** On the core side, the response allocation and the slice taken from the cache are derived from the *same* datapoint count, and must stay that way. Sizing them independently lets them disagree by a datapoint: a short slice leaves a zero datapoint at the end of the signal, a long one overruns the array and `set` throws. The renderer depends on this; the contract is pinned by the `getSignals datapoint count` test in the core package — including the 256 Hz case, which must stay unchanged.

**Known residual at low rates.** `getSignals` returns a bare array per channel whose sample *k* is implied to sit at `range[0] + k/samplingRate`, but the underlying samples are only aligned to the recording, not to an arbitrary range start — the reader slices from `round((rangeStart - cacheStart)*rate)`. The presented times are therefore off by up to half a sample period: negligible at 256 Hz (2 ms), but up to half a second for a 1 Hz trend, which can make it appear to shift against the EEG while scrolling. The renderer and the serving layer agree on the contract, so nothing is internally inconsistent; fixing it means carrying an explicit sample phase (or absolute start time) per signal through the response — one `start` per part cannot express it, because each channel has its own phase at its own rate.

**`heightInSensRefUnits`**: when set, computes `pxPerSensRefUnit = canvasHeight / value`. When sensitivity reference unit is cm, this produces correct μV/cm amplitude display.

**Canvas**: positioned `absolute` within the plot `div`, pointer-events disabled (pointer handling is on the overlay div above it).

### Signal data end-to-end summary

```
viewStart changes (user navigates)
  → EegPlot.updateTraces()
    → RESOURCE.getAllSignals([start, end])
      → EegRecording → activeMontage.getAllSignals()
        → MontageService.getSignals() [commission to MontageWorker]
          → MontageWorker/MontageProcessor: derivation + filters → Float32Array[]
            ← back to main thread via postMessage
      ← getAllSignals() resolves with { signals: Float32Array[] }
    → line.setData(signals[i].data) for each WebGlPlotTrace
    → newSignalData = true
  → requestAnimationFrame → wglPlot.update()
    → gl.bufferData(xy) + gl.drawArrays(LINE_STRIP)
```

---

## Plugin, store vocabulary, settings, and module system

### `EpicurrentsPlugin`

Source: [src/epicurrents/EpicurrentsPlugin.ts](src/epicurrents/EpicurrentsPlugin.ts)

Minimal Vue plugin. `install(app, options)` registers five globals via both `app.provide()` (Composition API) and `app.config.globalProperties` (Options API):

| Key | Value |
|---|---|
| `$config` | `window.__EPICURRENTS__.SETUP` — the startup configuration object |
| `$epicurrents` | The `EpicurrentsApp` instance |
| `$interface` | The `InterfaceModule` (the `DefaultInterface` instance) |
| `$eventBus` | `epicApp.eventBus` — the core typed event bus |
| `$runtime` | `epicApp.runtime` — the `RuntimeStateManager` |

Any component can then use `inject('$runtime')` or `this.$runtime` to reach the core runtime directly, without going through Vuex.

### Store actions vocabulary

Source: [src/store/actions.ts](src/store/actions.ts)

Actions split into two behavioral categories:

**Broadcast-only actions** — do nothing themselves, exist so components can `subscribeAction` on them:
- `display-callout`, `display-viewer`, `load-dataset-progress`, `overlay-clicked`, `pointer-left-app`, `redo-action`, `undo-action`, `toggle-dialog`, `create-dataset`

**State-mutating actions** — validate, then commit a mutation:
- `set-active-resource`: key action. First awaits `disableAllOtherResources()` (deactivates all other resources, waits for each deactivation if memory manager is in use to avoid SAB race conditions). Then checks that the view required by the resource's modality (`INTERFACE.modules.get(modality)?.settings?.compatibleView`) is available. Then commits `SET_ACTIVE_RESOURCE`.
- `set-view`: looks up the view in `applicationViews` map, commits `SET_VIEW`, then applies per-view UI component defaults (e.g., hiding the navigator in some views).
- `toggle-ui-component` / `set-ui-component-visible`: guard against unknown component names before committing.
- `toggle-fullscreen`: uses browser fullscreen API directly.
- `set-settings-value`, `add-dataset`, `set-active-dataset`, etc.: thin wrappers.

**Promise-bridge actions** — `load-study-url`, `load-study-folder`, `load-study-file`:
```ts
let resolve, reject
const promise = new Promise((res, rej) => { resolve = res; reject = rej })
commit(LOAD_STUDY_URL, { study: payload, promise: { resolve, reject } })
return promise
```
The commit is broadcast-only. `DefaultInterface` subscribes to it and calls `epicApp.loadStudy()`, resolving the promise when done. This decouples the store from knowing about the Epicurrents API.

### Store mutations vocabulary

Source: [src/store/mutations.ts](src/store/mutations.ts)

**Broadcast-only mutations** — body is `null`, exist only as subscription trigger points:
- `add-styles`, `load-dataset-folder`, `load-study-file`, `load-study-folder`, `load-study-url`

**State mutations** — directly modify `state.APP.*` or delegate to `RuntimeStateManager`:

| Mutation | What it does |
|---|---|
| `set-active-resource` | Calls `state.setActiveResource(payload)` on the runtime; sets `APP.activeModality` |
| `set-settings-value` | Tries `INTERFACE.setFieldValue()` first, then `state.setSettingsValue()`. If changed and user-definable, persists to `sessionStorage` (and `localStorage` if it already exists) |
| `accept-disclaimer` | Sets `INTERFACE.app.disclaimerAccepted = Date.now()` and saves to storage |
| `toggle-expand-viewer` | Mutates `INTERFACE.app.isExpanded`, then calls `INTERFACE.onPropertyUpdate()` to fire registered property change handlers (necessary because INTERFACE is not reactive) |
| `set-active-dataset` | Delegates to `state.setActiveDataset(payload)` on the runtime |
| `add-connector` / `remove-connector` | Delegates to `state.addConnector()` / `state.removeConnector()` |
| `set-view` | `state.APP.view = payload` |
| `set-fullscreen` | `state.APP.isFullscreen = payload` |

**Key insight on `set-settings-value`**: Interface settings (`INTERFACE`) take priority over core runtime settings. The mutation calls `INTERFACE.setFieldValue()` first — if the field exists there, it's set and the core runtime is never touched. This lets the interface layer shadow/override any core setting without conflict.

### Module properties — the two owners behind one setter

Source: [src/config/properties.ts](src/config/properties.ts), each module's `index.ts`

A module's UI state has two owners. Properties of the **resource** — `sensitivity`, `timebase`, the filters, `active-montage` — belong to the core module and reach the resource through `StateManager.setModulePropertyValue`. Properties of the **interface** — which sidebar is open, whether the trend strip is shown — live on the interface module's `runtime` object, which is a plain object rather than an asset.

Each module declares the interface-side properties it owns, keyed by the kebab-case name callers address them with, mapped onto the camel-case runtime field behind it:

```ts
export const properties: ModulePropertyRegistry = {
    'trend-visible': { field: 'trendVisible', type: 'Boolean' },
    'open-sidebar': { field: 'openSidebar', type: 'String?' },
}
```

`type` is a constructor name, `'?'`-suffixed when `null` is also accepted — the notation worker commissions use. `createPropertySetter` builds the setter from the registry: it validates, assigns, and dispatches `property-change:<module>.<property>` on the shared bus under the interface scope. **Every write goes through it**, including toggles and any assignment made during configuration or a lifecycle hook; assigning the runtime field directly announces nothing and is the bug this replaced.

`AppStore.addModule` chains the two owners behind the module's setter: the module answers for its own registry and reports whether the name was its own, and anything it does not claim goes to the core module. A name neither owner claims still reaches the core module's if-chain and is absorbed there without a word.

**Reading and watching** go through the context, by the same name and with the same teardown as a settings field:

```ts
this.addPropertyChangeHandler(`${this.SCOPE}.trend-visible`, this.trendVisibleChanged)
const visible = this.getFieldValue(`${this.SCOPE}.trend-visible`)
```

`addPropertyChangeHandler` resolves a module property first, then the interface settings tree, then the core one; resolution is by the qualified `<module>.<property>` name, which is unique across owners in a way a bare name is not. Handlers take no arguments — `PropertyChangeHandler` is declared as a generic *function* signature that only a zero-argument handler can satisfy — so a handler reads the current value through `getFieldValue`. Menu items and toolbar controls name a property in their `reloadOn` list with the `property:` scope, alongside `settings:`.

Do **not** observe a module property by subscribing to the action that sets it. The property announces itself, so one handler covers every route to the value: `eeg.set-trend-visible` and `eeg.toggle-trend-visible` both land as one `trend-visible` change.

### Settings persistence and the `source` flag

Source: [src/store/userSettings.ts](src/store/userSettings.ts), `AppStore.loadLocalSettings` / `loadUserSettings` / `applySettingsMap`

User-definable settings are persisted in up to two places. The **device copy** always exists: `sessionStorage` under the key `epicurrents`, mirrored into `localStorage` when an entry is already there, written from the `set-settings-value` mutation. The **account copy** exists only when the host sets `app.userSettingsBackend`; it is read once at startup and applied over the device copy, and later changes are written back with a one-second debounce. Both are limited to fields the owning module lists in `_userDefinable`, with a matching value constructor.

A write is tagged with where it came from. `setFieldValue` takes an optional `SettingsChangeContext` whose `source` is `'user'` (the default when omitted) or `'system'`, and the tag rides into the dispatched change event. **Anything that writes a change back out must ignore `'system'`.** `applySettingsMap` marks every field it restores that way, because a restore that looked like an edit would be written straight back to the storage it was just read from — harmless for the device copy, actively wrong for an account copy shared across the user's machines.

The two settings trees emit on different scopes, and a listener that wants all settings changes has to subscribe to both: the interface tree dispatches `InterfaceEvents.SETTING_CHANGED` under `EventScopes.INTERFACE`, the core tree `ApplicationEvents.SETTING_CHANGED` under `EventScopes.APPLICATION`. Both carry the dotted field path, the new and old values, and `source`.

The account mirror is deliberately quiet: every failure is logged and dropped, both requests carry a timeout so an unreachable backend cannot stall startup, and nothing is written before a read has succeeded — a write replaces the stored map wholesale, so writing from a picture that was never populated would erase the user's settings elsewhere.

### `INTERFACE` singleton and settings system

Source: [src/config/index.ts](src/config/index.ts)

`INTERFACE` is a **module-level singleton object** (not reactive, not in Vuex state). It runs in parallel with the core `SETTINGS` object and holds interface-specific settings. It has its own property change handler registry (`_PropertyChangeHandlers[]`) — separate from the core `scoped-event-bus` system.

**`INTERFACE.setFieldValue(field, value)`**: dotted path traversal (e.g. `'eeg.sensitivity'` → looks up `eeg` module settings → `sensitivity` field). Auto-converts hex/rgba strings to settings color objects. Validates constructor type match before writing. Calls `INTERFACE.onPropertyUpdate()` on success.

**`applicationViews`**: `Map<string, ApplicationView>` with keys `'biosignal'`, `'default'`, `'media'`, `'radiology'`. Populated from per-view config files. Used by `set-active-resource` to switch to the correct view for a modality.

### `useContext(store, context)` — the universal composable

Every component in the interface calls a variant of this. It returns:

```ts
{
    ID: string,          // Unique per-call ID for event subscription tracking
    RUNTIME: StateManager,
    PYODIDE: { service: PythonInterpreterService | null, usesMemoryManager: boolean },
    SCOPE: string,       // e.g. 'eeg'
    SCHEMAS: ...,        // Module-specific JSON schemas
    SETTINGS: Proxy,     // See below
    addPropertyChangeHandler(field, handler): void,
    getFieldValue(field, depth?): SettingsValue,
    removePropertyChangeHandlers(): void,
    setFieldValue(field, value): boolean,
}
```

**Watching a settings field**: call `addPropertyChangeHandler(field, handler)` with the fully-qualified dotted path, and `removePropertyChangeHandlers()` once in `beforeUnmount`. The handler fires for the named field *and every descendant of it*, so `('eeg.grid', h)` covers `eeg.grid.major.width`. Registration resolves to whichever settings tree declares the field, so a caller never has to know which of the two owns it, and every handler added through one context is keyed on that context's `ID` — the teardown call removes all of them from both trees at once.

Do **not** subscribe to the `set-settings-value` store mutation to observe a settings change. That route sees only the field the mutation carries, has no tree resolution, and needs its own unsubscriber. `addPropertyChangeHandler` is the read side of settings; the `set-settings-value` dispatch remains the write side, because it is what persists user-definable fields to storage.

Handlers currently take no arguments and re-read through `getFieldValue` when they need the value — `PropertyChangeHandler` is declared as a generic *function* signature (`<T>(newValue?: T, …)`), which only a zero-argument handler can satisfy.

**`SETTINGS` is a `Proxy`**: reads try interface settings first (`INTERFACE.modules.get(context)?.settings`), then core runtime settings (`store.state.SETTINGS.modules[context]`). Writes go to whichever source declares the field, interface first; a field declared in neither is created on the interface settings. Where both sources carry the same key with plain-object values, the returned value is itself a proxy applying the same two-source resolution, so nested keys can live in either source without one shadowing the other. This shadow pattern means interface settings always override core without needing to copy values.

**Specialised variants:**
- `useAppContext(store)` — context `'app'`, typed to `AppSettings & AppModuleSettings`
- `useBiosignalContext(store)` — context of the active modality, adds typed `RESOURCE: BiosignalResource`
- `useEegContext(store)` — context `'eeg'`, adds typed `RESOURCE: EegResource` and `SETTINGS` typed to `EegModuleSettings & EegInterfaceSettings`

The `ID` field is consumed by `RESOURCE.onPropertyChange(field, handler, ID)` — when a component unmounts it passes `ID` to `removeAllEventListeners(ID)` to clean up all subscriptions at once without tracking individual handlers.

### EEG module registration

Source: [src/app/modules/eeg/index.ts](src/app/modules/eeg/index.ts)

The `runtime` export is a plain object (not a class) that satisfies `InterfaceResourceModule`:

**`applyConfiguration(config)`**: processes a `EegModuleConfiguration` JSON (from config file or inline object):
- `epochMode.enabled/epochLength/onlyFullEpochs`
- `extraMontages`: per-setup arrays of montage templates (URL strings → fetched, or inline objects)
- `extraSetups`: setup config objects (URL strings → fetched)
- `hotkeys`: annotation, examine, fft, topogram hotkeys

**Component getters** — all lazy-loaded:
```ts
getViewerComponent: () => loadAsyncComponent(() => import('./components/EegViewer.vue'))
getControlsComponent: () => loadAsyncComponent(() => import('./components/EegControls.vue'))
getFooterComponent: () => loadAsyncComponent(() => import('./components/EegFooter.vue'))
```
These are called by the store's `getResourceViewer/Controls/Footer` getters whenever the active resource modality is `'eeg'`.

**`resourceLifecycleHooks.created(resource)`**: called when a new `EegResource` is added to the runtime. Automatically applies all `settings.extraSetups` and `settings.extraMontages` to the resource — this is how consumer-specific montage configurations propagate into newly loaded recordings without touching core EEG module code.

**`setPropertyValue`**: initially a no-op stub. Overridden by `AppStore.addModule()` to:
```ts
module.runtime.setPropertyValue = (property, value) =>
    this.runtime?.setModulePropertyValue('eeg', property, value)
```
So EEG actions like `SET_SENSITIVITY` call `runtime.setPropertyValue('sensitivity', value)` → `RuntimeStateManager.setModulePropertyValue('eeg', 'sensitivity', value)` → updates the EEG module's settings in the core runtime.

**EEG-specific Vuex actions** (prefixed `'eeg.'`):
- `eeg.set-active-montage`, `eeg.set-sensitivity`, `eeg.set-timebase`
- `eeg.set-highpass-filter`, `eeg.set-lowpass-filter`, `eeg.set-notch-filter`
- `eeg.set-cursor-tool`, `eeg.set-open-sidebar`, `eeg.set-report-open`
- `eeg.toggle-annotation-sidebar` (broadcast only)

All injected into the live Vuex store via `hotUpdate()` when `loadModules()` runs.

---

## Biosignal trend rendering

A **trend** is a derived per-epoch signal computed from one or more montage channels; the trend assets, their math and the worker plumbing all live in `@epicurrents/core` and the modality modules, and the interface only renders what those produce. The interface side is a strip component that reads the active montage's `trends` property and dispatches on `trend.derivation.type`.

### `EegTrend.vue` (general-purpose trend strip)

[src/app/modules/eeg/components/EegTrend.vue](src/app/modules/eeg/components/EegTrend.vue) is a standalone component (not coupled to `EegNavigator`). It:

- Mirrors the navigator's horizontal layout: 80 px left gutter for derivation labels, plot canvas in the middle, 30 px right padding for the amplitude scale and to keep the x-axis aligned with the navigator below it.
- **Two-canvas pattern** (same as `EmgNavigator`): heavy `drawTrends()` paints the bands on the main canvas; lightweight `drawViewbox()` paints the red view-position bar on a second absolutely-positioned canvas. Scrolling only repaints the viewbox layer.
- **Viewbox bitmap is height-fixed at 1 px** and stretched to fill the strip via CSS (`:style="{ width, height: canvasHeight - 2 + 'px' }"`). The width attribute must also be set in CSS — modern browsers compute an implicit `aspect-ratio` from the canvas `width`/`height` attributes, and leaving CSS width unset makes the canvas explode horizontally when only the CSS height is bound. With a fixed bitmap height, `height` changes on the trend strip never auto-clear the viewbox bitmap, so the red bar survives resizing without a redraw.
- Subscribes to the active montage's `trends` property and to each trend's `'trend-epoch'` / `'trend-complete'` events for progressive rendering.
- Dispatches by `trend.derivation.type`: today only `'amplitude'` (`_drawAmplitudeBand`) — new types add new branches and new `_draw*` methods.
- `displayMode` prop ("separate" / "superimposed" / null=fallback to setting) is overridable by the parent so layout breakpoints can force `superimposed` when the strip is compressed.

#### Amplitude scale and zero-line

- The right 30 px padding hosts a small Hellström-Westas amplitude scale. Tick markers at 10, 20, 50, 100, 200 and 500 µV — 10 and 100 are labelled, the rest are bare tick lines. Compression follows `compressAmplitudeValue` in `@epicurrents/core` (`src/util/signal.ts` there) so tick y-positions match the rendered band exactly. The `compressMicrovolts` helper in `EegTrend.vue` duplicates the formula for the label positioning, deliberately kept local because the scale is presentation-only.
- The scale anchor (`.scale`) is positioned at `right: 30px` (= the canvas's right edge). Tick lines extend leftward into the canvas; numeric labels float rightward into the padding. Both are vertically centred on their value's y-coordinate via `transform: translateY(-50%)`.
- In stacked (separate) mode the scale is drawn per slot. In superimposed mode there's a single full-strip scale.
- A **zero-line separator** is drawn between adjacent slots in stacked mode (`drawTrends` final loop). The separator is the bottom of the upper slot and the top of the lower slot — i.e. value = 0 for the upper trend. Painted in the navigator's `borderColor`.

#### Derivation labels — side-aware colours and slot anchoring

- Side-aware colour resolution: `_sideColorForTrend(name)` matches the trend's `aeeg-<id>` name and returns `SETTINGS.trace.color.sin` (`left`), `.dex` (`right`), or `.mid` (`central`/`mid`). Falls back to the colour stored on the trend asset itself. This keeps trend bands in sync with the EEG side-colour theme so a single setting change re-themes both raw EEG traces and aEEG bands.
- Labels render text first, colour dot second — the dot sits closest to the trend band on the right.
- **Layout modes** (`labelStyles` computed):
  - `layout-separate`: each label is `position: absolute` with `bottom: canvasHeight - slot.bottom + 'px'`, anchoring its bottom edge to the slot's zero-line.
  - `layout-superimposed`: container is a `flex-direction: column; justify-content: flex-end; align-items: flex-end` so labels stack at the bottom-right of the combined area.
- Labels are right-aligned via `right: 0.5rem` in separate mode and via flex `align-items: flex-end` in superimposed mode. The legend shows the **electrode/derivation name only** (`C3`, `P3-P4`, …) — no side prefix, because the side colour already conveys the hemisphere.

### `EegNavigator.vue` — also uses the two-canvas viewbox split

Identical pattern: `drawNavigator()` paints the heavy content (events, highlights, channel rejection, cached/loaded bars, interruptions, ticks), `drawViewbox()` paints the red bar on a second canvas overlay. `RESOURCE.onPropertyChange('displayViewStart', drawViewbox)` and the `visibleRange` watcher both target `drawViewbox` only.

CSS pattern (applies to both):
```css
.timeline { position: relative; }
.timeline > canvas + canvas { position: absolute; top: 10px; left: 0; }
```

The viewbox canvas also gets `style="pointer-events: none;"` inline so clicks pass through to the main canvas.

### EegViewer split-panel layout (with trend strip)

The viewer is two nested `SplitPanelView` instances ([src/app/views/SplitPanelView.vue](src/app/views/SplitPanelView.vue) wraps `wa-split-panel`):

```
outer (orientation=vertical, primary-slot=end)
├── start: inner split (horizontal: plot | annotation sidebar)
└── end: bottom-stack
        ├── EegTrend           (flex 1 1 auto, min-height: 0)  ← optional
        └── EegNavigator       (flex 0 0 auto)
```

**Bottom-slot sizing breakpoints** (all in `EegViewer.vue`):

| Bottom slot height | Behaviour |
|---|---|
| `< 75 px` | Forbidden — clamped by `:primary-size-bounds[0]` |
| `75 px` (no trend) | Navigator only, full slot |
| `75 px` (trend on) | Trend hidden, navigator owns full slot (`effectiveTrendVisible = false`) |
| `75–115 px` (trend on) | `trendHeight < 40` → trend hidden, navigator gets full slot |
| `115–155 px` (trend on) | Trend shown, forced `'superimposed'` mode (`trendHeight < 80`) |
| `≥ 155 px` (trend on) | Trend shown, mode follows `SETTINGS.aeeg.displayMode` |

**Toggling**: `eeg.set-trend-visible` (payload `boolean`) and `eeg.toggle-trend-visible` are broadcast Vuex actions. `EegViewer.subscribeAction` listens and calls `setTrendVisible(visible)`, which:
- Sets `trendVisible` (local ref).
- On toggle-on: expands `navigatorHeight` to `75 + 150 = 225 px` if it's currently smaller. (We don't shrink past a user-set larger size.)
- On toggle-off: **snaps back** to `75 px` per the design choice — the trend's size is not remembered.

**`SplitPanelView.primaryStartSize` reactivity gotcha**: the prop name suggests "initial" but the watcher in `SplitPanelView.vue` mirrors the prop → internal `primarySize` ref so updates after mount actually move the divider. Without the watcher, `navigatorHeight.value = newSize` from a parent has no visual effect.

**Bottom-slot bounds** (`bottomSlotBounds` computed) are dynamic:
- Trend off: `['75px', '20%']` (legacy cap)
- Trend on: `['75px', '40%']` (allow room for the trend strip)

---

## Gotchas

### Core runtime mutations do not trigger Vue reactivity

The Vuex state is the `RuntimeStateManager` instance, so reads through `$store.state.APP.x` return a tracked reactive proxy. Writes performed by the core package do not go through it. Every mutating method on the manager writes through the module-level `state` object it closes over rather than through `this`:

```ts
// @epicurrents/core — src/runtime/index.ts
export const state: RuntimeState = { APP: APP_MODULE, … }
addDataset (dataset) { state.APP.datasets.push(dataset) }
setActiveDataset (dataset) { … state.APP.activeDataset = dataset }
```

Invoking the method through the reactive proxy does not help, because the body never touches `this`. The practical consequence is that no core-owned field — `activeDataset`, `datasets`, `connectors`, the study registries — ever notifies a template or computed property when core changes it.

Interface code compensates by subscribing to the runtime's own event bus (`state.addEventListener([...], handler, caller)`, used in around a dozen components) or to the relevant store mutation, then re-reading. [DatasetNavigator.vue](src/app/navigator/DatasetNavigator.vue) shows the pattern in its most explicit form: an `updateCounter` ref, referenced inside the `sortedResources` computed purely to create a dependency, and incremented from an `add-resource` / `set-active-dataset` / `set-active-resource` listener.

**When adding a component that displays core-owned state**, drive it from a bus subscription rather than assuming the read is live. Interface-owned fields (those `AppStore`'s constructor assigns onto `runtime.APP`) are written through the proxy by store mutations and *are* reactive.

### `wa-reposition` fires before wa-split-panel re-renders — `offsetHeight` is stale

wa-split-panel's `handlePositionChange` calls `dispatchEvent(new WaRepositionEvent())` synchronously, **before** the LitElement render() applies the new grid-template style. `SplitPanelView.handleDividerMove` listens for `wa-reposition` — if it reads `this.end.offsetHeight` at that moment, the value reflects the PRE-RENDER layout and lags the actual divider position by one frame.

This bug had two distinct manifestations:

1. **Programmatic toggle didn't collapse the slot** (trend strip toggle off): an earlier "echo-suppression" filter in `SplitPanelView.primaryStartSize` watcher compared incoming prop values against a tracked `lastEmittedSize` populated from the stale `offsetHeight`. After toggle-on (75 → 225) the stale event poisoned `lastEmittedSize = 75`, and the next toggle-off back to 75 was filtered as an echo.

2. **Manual resize → infinite 2-pixel oscillation** (77 ↔ 79 indefinitely): during user drag, the stale `offsetHeight` consistently lagged the live position by one frame, so the loop `drag → emit(stale) → parent updates navigatorHeight → prop change → wa-split-panel re-renders → emit(new stale) → …` never converged. The previous 1-pixel parent filter caught only single-frame echoes; 2-frame lag slipped through.

**Resolution**: `SplitPanelView.handleDividerMove` schedules its measurement via `requestAnimationFrame`. By the time the callback runs, LitElement has rendered and CSS layout has applied the `clamp(var(--min), …, var(--max))`, so `offsetHeight`/`offsetWidth` accurately reflect the *displayed* slot size. The 1-frame delay (~16 ms) is below the perceptible threshold for resize feedback.

The parent `handleNavigatorResize` filter uses a sub-pixel threshold (`< 0.5`) — real user drags of 1 pixel propagate, while float-precision round-trip echoes still get filtered. The `SplitPanelView.primaryStartSize` watcher carries no echo filter; the rAF defer plus the sub-pixel parent filter together break all the feedback scenarios.

**Why not read `panel.positionInPixels` directly?** That property updates synchronously inside `handlePositionChange` *before* `wa-reposition` is dispatched, so it's live — but it's also **unclamped**: it stores the user's full drag target even when the CSS bounds keep the displayed slot at a smaller size. Propagating it would let `navigatorHeight` grow past the configured maximum (`primary-size-bounds`), which is what made the bounds appear to disappear. `offsetHeight` measured one frame later is the only reading that respects the bounds.

**Guard against invalid values at the parent**: on initial mount wa-split-panel's `connectedCallback` runs before its host is laid out — `detectSize()` returns 0, and the first Vue-driven attribute set computes `Infinity`/`NaN` internally. Any transient `wa-reposition` fired during this window would emit an offsetHeight of 0 (slots not yet laid out). `handleNavigatorResize` guards with `Number.isFinite(next) && next > 0` and rejects, preventing `NaN`/0 from propagating into `plotDimensions[1] = viewerSize - navigatorHeight` and breaking the EEG plot's initial render.

### Module runtime state on `state.INTERFACE.modules` — live getters, not snapshots

The Vuex state has two superficially-similar `Map`s. They actually contain different objects:

- `state.MODULES.get(name)` — the **core** module's runtime (registered via `Epicurrents.registerModule()` → core `RuntimeStateManager.setModule()`). For EEG this is `@epicurrents/eeg-module`'s runtime — without interface-specific fields like `trendVisible`.
- `state.INTERFACE.modules.get(name)` — the **interface** module's combined config + runtime data. Populated by `AppStore.addModule()`.

`AppStore.addModule()` installs live getters on `modConfig` for every non-method property on the interface module's `runtime` (primitives, objects, arrays — methods stay on the runtime itself). The getters read directly from `runtime`, so `state.INTERFACE.modules.get('eeg').trendVisible` reflects the current value rather than a snapshot taken at registration. Existing keys (`schemas`/`settings`) take precedence over runtime keys with the same name.

**Read a runtime field through the property registry, not through this Map.** `getFieldValue('eeg.trend-visible')` (or `getModuleProperty` outside a component) resolves the same value by its declared name, needs no structural cast, and pairs with a change notification — the getters here tell a reader nothing when the value changes, which is why every consumer that used them also had to subscribe to the action that set them. See [Module properties](#module-properties--the-two-owners-behind-one-setter). The getters remain for runtime fields a module has not declared as properties.

### Vuex `subscribeAction(handler)` defaults to `before`

`store.subscribeAction(handler)` invokes the handler *before* the action's mutation handler runs. When `AppMenubar`'s subscribeAction iterates menu items' `reloadOn` callbacks, those callbacks need the post-action state. Use the `store.subscribeAction({ before, after })` form and put the reloadOn dispatch in `after`. Menu-closing logic (pointer-left-app, overlay-clicked) stays in `before` because its effect is independent of any state mutation.
