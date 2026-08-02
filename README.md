# Epicurrents — Interface Module

The Vue/Vite user interface for the Epicurrents viewer. It implements the `InterfaceModule` contract from `@epicurrents/core` (`DefaultInterface`) and renders whatever modality modules the consumer registers.

This package builds to the per-module **`dist/` package** — the form other builds consume. In the normal workflow the [builder](../) assembles it (together with the `@epicurrents/*` packages) into a distributable **edition**: a runtime `<script>` lib and a standalone folder. This package does not produce those itself, but it can still be run and built on its own for development and demos.

## Scripts

| Command | Output |
|---|---|
| `npm run dev` (or `start`) | Vite dev server with HMR |
| `npm run build` | the `dist/` package (`vite.config.dist.ts`) — per-module entries a bundler composes from; this is what the builder and host apps consume |
| `npm run build:app` | a self-contained standalone web app in `build/app/` (`vite.config.app.ts`), for quick demos |
| `npm run typecheck` | type-check only, honouring `INCLUDE_MODULES` (see [scripts/README.md](scripts/README.md)) |

The `@epicurrents/*` packages are cloned, installed and built by the builder (`frontend/viewer/scripts/`) — the interface no longer manages them itself, and worker bundles are emitted by Vite rather than copied.

## Using the interface as a package

Register the interface into a host application built on `@epicurrents/core` through `createEpicurrentsApp`, whose callback registers the modules your build needs:

```ts
import { createEpicurrentsApp, type SetupContext } from '@epicurrents/interface'
import * as interfaceEegModule from '@epicurrents/interface/modules/eeg'

createEpicurrentsApp(config, async ({ app, registerInterfaceModule }: SetupContext) => {
    // Register the core modules / readers your build needs, then their interface UI:
    registerInterfaceModule('eeg', interfaceEegModule)
})
```

Per-modality UI is exposed as subpath exports (`@epicurrents/interface/modules/<name>`) so a consumer's bundler pulls in only what it imports. The all-in reference setup that wires every module together is `src/setups/full.example.ts`, which the standalone dev and app builds use.

## Customising which modules are registered

`src/setups/full.example.ts` is the all-in reference: it imports the modality modules (EEG, EDF, DICOM, HTM/Markdown, PDF, …), configures them and registers them through the `createEpicurrentsApp` callback (`registerInterfaceModule`, plus the core `registerModule` / `registerStudyImporter`). It respects `SETUP.activeModules` — an empty list enables a default set, otherwise only the listed modules register.

To trim a build to specific modalities without editing the setup, set `INCLUDE_MODULES` (see [scripts/README.md](scripts/README.md)): it drops the other `src/app/modules/<name>/` UI dirs from both the bundle and the type-check. The builder drives this per edition.

Worker sources are embedded via `inlineWorker(…?raw)` so Vite's dev server and single-file builds work reliably. Pyodide needs a WASM/asset path via `SETUP.pyodideAssetPath` (defaults to JSDelivr; loading WASM over `file://` is not allowed). SharedArrayBuffer / memory-manager features fall back to substitutes when SAB is unavailable.

## Configuring active modules at runtime

Set `window.__EPICURRENTS__.SETUP` before the entry script runs — for example inline in the hosting HTML before loading the bundle:

```html
<script>
    window.__EPICURRENTS__ = window.__EPICURRENTS__ || {}
    window.__EPICURRENTS__.SETUP = {
        activeModules: ['eeg', 'htm', 'pdf'],
        usePyodide: false,
        isProduction: true,
        appName: 'My Epicurrents App',
    }
</script>
```

## Useful files

- Standalone entry: `src/setups/standalone.ts`; all-in reference setup: `src/setups/full.example.ts`
- Interface implementation: `src/DefaultInterface.ts`
- Vite configs: `vite.config.dist.ts` (the `dist/` package), `vite.config.app.ts` (standalone app), `vite.config.ts` (dev)
- Type-check: `scripts/typecheck.mjs`

## Development notes

**Icons**

Icons are served via the `epicurrents` WebAwesome icon library registered in `src/app/AppIcon.vue`. The icon set is [Material Symbols](https://github.com/google/material-design-icons/tree/master/symbols) (`@material-symbols/svg-400`), copyright Google LLC, licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). Each icon SVG must be explicitly imported as a raw string in `src/app/icons.ts` so that Vite can inline it into the bundle at build time. This is required for both the UMD/singlefile build (where `import.meta.url`-based asset URLs are not available) and for PWA offline support (icons are bundled directly rather than fetched from a separate URL).

When you need to use a new icon in any component:

1. Identify the Material Symbols icon name (snake\_case, e.g. `lock_open`).
2. Add a `?raw` import for each style variant you need (`outlined` is the default; `filled` is used for `variant="solid"`). The filled variant lives in the same `outlined/` directory with a `-fill` suffix:

```ts
import lock_open from '@material-symbols/svg-400/outlined/lock_open.svg?raw'
// If you also need a filled variant:
import lock_open_filled from '@material-symbols/svg-400/outlined/lock_open-fill.svg?raw'
```

3. Add an entry to the `ICON_SVGS` table in the same file:

```ts
lock_open: { outlined: lock_open, filled: lock_open_filled },
```

4. If the icon is referenced in a component by a Font Awesome kebab-case name (e.g. `lock-open`), add a mapping entry to the `FA_TO_MATERIAL` object in `src/app/AppIcon.vue`:

```ts
'lock-open': 'lock_open',
```

If you use the Material snake\_case name directly in the component (i.e. `name="lock_open"`), step 4 is not needed — the resolver falls back to the name as-is when no FA mapping exists.

**WebAwesome `registerIconLibrary` when used as a library**

When this package is embedded as a library inside a host application that also uses WebAwesome, both bundles will contain their own copy of `registerIconLibrary`. Calling the copy bundled with the interface registers the icon library in the interface's own WA instance, but the host's WA instance — which owns the `<wa-icon>` elements rendered in the DOM — is unaware of it, so icons remain blank.

The fix is to expose the host application's `registerIconLibrary` on `window.__EPICURRENTS__` before the interface initialises:

```ts
import { registerIconLibrary } from '@awesome.me/webawesome'

window.__EPICURRENTS__ = window.__EPICURRENTS__ || {}
window.__EPICURRENTS__.registerIconLibrary = registerIconLibrary
```

`src/app/icons.ts` checks for this global first and falls back to its own bundled copy only when running standalone (i.e. when the interface owns the WA instance):

```ts
const register = window.__EPICURRENTS__?.registerIconLibrary ?? registerIconLibrary
```

If the host application does not use WebAwesome at all, no action is required — the bundled fallback is used automatically.

## Dependencies and TODOs

This interface module has a couple of dependencies that may limit its use or are in the process of being replaced:
- Vuex store for reactive state management in Vue components. This should be replaced with the newer Pinia store, however, the interface currently depends on events from Vuex. The goal is to replace these Vuex events with ones from the Epicurrents event bus (this work is underway) and finally switch from Vuex to Pinia for state management.
