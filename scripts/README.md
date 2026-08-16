# Interface scripts

## `typecheck.mjs`

Type-checks the interface, honouring the `INCLUDE_MODULES` allowlist so a targeted distribution type-checks only the modules it ships. Empty `INCLUDE_MODULES` type-checks everything (the full build); a non-empty list generates a scoped `tsconfig` that excludes the `src/app/modules/<name>/` UI dirs not in the list (plus the all-in `standalone.example` / `standalone.ts`), so a build without the other modules' packages installed still type-checks. Invoked by the `build`, `build:app`, `build:custom` and `typecheck` npm scripts; it mirrors the bundle-side module exclusion in the vite configs.

## `verify-topography.mjs`

Asserts the scalp field renderer's invariants in a headless Chromium, against the real bundled sources. Not run by any npm script — it needs `playwright` and `esbuild`, and a browser (`PLAYWRIGHT_CHROMIUM` points it at an existing binary). Run it after touching `components/plots/topography/`.

Six of the eight checks cover orientation, and they are asserted together on purpose: they are coupled through the sign of the view matrix's determinant, the front-face winding that follows from it, and the drag signs that follow the screen-x row, so checking them one at a time lets a compensating pair of errors pass unnoticed. The other two cover regressions that reached a running application — a renderer built against an older `@epicurrents/eeg-module` must degrade rather than throw, and electrodes must be visible from behind the head rather than buried in the scalp mesh.

These belong in unit tests. They live in a script because this package has no test runner configured; move them when it has one.

## Retired

The dependency-management scripts (`setup`, `deps:*`) and `copy:workers` were removed. Cloning, installing and building the `@epicurrents/*` packages is the builder's job (`frontend/viewer/scripts/`), and worker bundles are emitted by vite rather than copied into `dist/`.
