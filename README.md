# Epicurrents — Interface Module

This package contains the Vue/Vite-based interface for the Epicurrents library. The interface can be used in two ways:

- As a standalone web application (dedicated build and public assets).
- As a library that registers `ViteInterface` into a host application built on `@epicurrents/core`.

**This README** documents how to build and run both workflows and how to customize the modules and workers used by the interface by editing the entry script at `src/setups/standalone.ts`.

**Quick commands**

- Development server (local dev with HMR):

```bash
npm run dev
```

- Start (copies worker assets then runs dev server):

```bash
npm run start
```

- Build the library (for consumption by other packages):

```bash
npm run build
```

- Build the standalone application (app bundle for public/):

```bash
npm run build:app
```

- Copy UMD bundles from internal dependencies into `public/` (useful for standalone distributions):

```bash
npm run copy:umd
```

Dependency helper scripts used by this package are available under the `dependencies/` helper scripts. See `package.json` for `deps:*` commands (prepare, build, install, update, etc.).

**1) Using the interface as a standalone application**

- Purpose: produce a self-contained web app in `dist`/`public` that can be deployed statically.
- Build: `npm run build:app` (produces production build using `vite.config.app.ts`).
- Dev: `npm run start` or `npm run dev` for development.
- When you build the app for production, ensure any required UMD artifacts (core/reader bundles) are available under `public/` — `npm run copy:umd` can help copy those from local packages.
- Workers: the standalone build inlines worker sources or uses the `public` worker files. `npm run copy:workers` (invoked by `start`) copies worker assets when needed.

**2) Using the interface as a library**

- Purpose: register the UI/controls from this package into a host application that uses `@epicurrents/core`.
- Build the library bundle: `npm run build` (uses `vite.config.lib.ts`).
- The package exports (see `package.json`) expose the built `dist` artifacts. In your host app, install or reference the built package and then register the interface:

Example usage in a host application:

```ts
import { Epicurrents } from '@epicurrents/core'
import { ViteInterface } from '@epicurrents/interface'

const app = new Epicurrents()
app.registerInterface(ViteInterface)
app.launch({ appName: 'My App', /* ...other settings... */ })
```

If you prefer to programmatically create a full application instance with interface glue (file loaders, modules, workers pre-registered), this repository provides a ready entry script at `src/setups/standalone.ts` which exports `createEpicurrentsApp` — you can study or re-use its patterns when building a host app.

**3) Customize which modules and components are registered**

- The main entry script for the standalone build is `src/setups/standalone.ts`.
- That file is the canonical place where modules (EEG, EDF, DICOM, HTM/Markdown, PDF, NCS, etc.) and service/workers are imported, configured and registered into the `Epicurrents` core.

How modifications work:

- Modules are registered with `coreApp.registerModule('<name>', module)` and associated importers/loaders are registered with `coreApp.registerStudyImporter(...)`.
- The script uses the `SETUP` object (merged from `window.__EPICURRENTS__.SETUP` and defaults) and respects `SETUP.activeModules` — when `activeModules` is empty the script enables a sensible default set; otherwise it conditionally registers only modules listed there.

Examples

- Disable a module from the build-time entry logic:

Open `src/setups/standalone.ts` and find the block for the module you want to remove, e.g. the NCS block:

```ts
// NCS module setup.
if (!SETUP.activeModules.length || SETUP.activeModules.includes('ncs')) {
		coreApp.registerModule('ncs', ncsModule)
}
```

To prevent registration, either remove this code or modify the condition so the module is not included. At runtime you can also ensure `SETUP.activeModules` does not list `'ncs'`.

- Add a new module or reader:

1. Import the module/reader at the top of `standalone.ts` (follow existing import conventions).
2. Add registration code similar to other modules, including any worker overrides and study importers.
3. When adding workers, follow the inline-worker pattern used in the file:

```ts
import mdWorkerSrc from '#root/dist/workers/markdown.worker.js?raw'
const mdWorker = () => inlineWorker('MarkdownWorker', mdWorkerSrc).create()
coreApp.setWorkerOverride('markdown', mdWorker)
```

Notes about workers and Pyodide

- `standalone.ts` often uses `inlineWorker(...?raw)` to embed worker sources so Vite's dev server and single-file builds work reliably. If you add new workers, ensure the worker is available under `dist/workers/` in production or that you inline its source similarly.
- Pyodide requires a WASM/asset path. The default `SETUP.pyodideAssetPath` points to JSDelivr. For local testing you can override that to point to a local `pyodide/` folder on a static server, but loading WASM via file:// is not allowed.
- SharedArrayBuffer / memory manager features are conditionally enabled in the entry script — if your environment does not support SAB, the script falls back to substitutes for some workers.

**4) Configuring active modules at runtime**

- You can set `window.__EPICURRENTS__.SETUP` before the entry script runs to control behavior. Example snippet (inline in your hosting HTML before loading the bundle):

```html
<script>
	window.__EPICURRENTS__ = window.__EPICURRENTS__ || {}
	window.__EPICURRENTS__.SETUP = {
		activeModules: ['eeg','htm','pdf'],
		usePyodide: false,
		isProduction: true,
		appName: 'My Epicurrents App',
	}
</script>
<script src="/path/to/standalone.bundle.js"></script>
```

**5) Troubleshooting & Tips**

- If you see issues with worker paths in dev, ensure `npm run start` was used (it runs `copy:workers`) or that your dev server serves the `dist/workers` files.
- For Pyodide-related import errors, set `SETUP.pyodideAssetPath` to a valid CDN or hosted path and check browser console network requests.
- For memory-worker fallbacks, check `SharedArrayBuffer` support and the `SETUP.useSAB` flag.

**6) Useful files & locations**

- Main entry script (standalone): `src/setups/standalone.ts`
- Library entry and interface implementation: see `src/ViteInterface.ts`
- Vite configs: `vite.config.app.ts` (standalone app) and `vite.config.lib.ts` (library)
- Worker copying / dependency helpers: `dependencies/` scripts referenced in `package.json`

**7) Next steps**

- To experiment quickly: run `npm run dev` and open the dev server URL.
- To prepare a standalone artifact for deployment: `npm run build:app` and ensure `public/` contains any needed UMD or worker files (`npm run copy:umd` / `npm run copy:workers`).

If you'd like, I can open `src/setups/standalone.ts` and add an annotated example showing how to add/remove a module and worker step-by-step.

**8) Dependencies and TODOs**

This interface module has a couple of dependencies that may limit its use or are in the process of being replaced:
- [WebAwesome](https://webawesome.com) for custom web components and a pro subscription to [FontAwesome](https://fontawesome.com) icons.
- Vuex store for reactive state management in Vue components. This should be replaced with the newer Pinia store, however, the interface currently depends on events from Vuex. The goal is to replace these Vuex events with ones from the Epicurrents event bus (this work is underway) and finally switch from Vuex to Pinia for state management.
