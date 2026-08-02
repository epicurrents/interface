# Interface scripts

## `typecheck.mjs`

Type-checks the interface, honouring the `INCLUDE_MODULES` allowlist so a targeted distribution type-checks only the modules it ships. Empty `INCLUDE_MODULES` type-checks everything (the full build); a non-empty list generates a scoped `tsconfig` that excludes the `src/app/modules/<name>/` UI dirs not in the list (plus the all-in `standalone.example` / `standalone.ts`), so a build without the other modules' packages installed still type-checks. Invoked by the `build`, `build:app`, `build:custom` and `typecheck` npm scripts; it mirrors the bundle-side module exclusion in the vite configs.

## Retired

The dependency-management scripts (`setup`, `deps:*`) and `copy:workers` were removed. Cloning, installing and building the `@epicurrents/*` packages is the builder's job (`frontend/viewer/scripts/`), and worker bundles are emitted by vite rather than copied into `dist/`.
