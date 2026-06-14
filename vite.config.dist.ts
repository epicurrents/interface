import { defineConfig } from 'vite'
import { isAbsolute } from 'path'
import { fileURLToPath, URL } from 'url'
import { config as DotenvConfig } from 'dotenv'
import tsconfigPaths from 'vite-tsconfig-paths'
import vue from '@vitejs/plugin-vue'

// Load environment variables from .env file.
DotenvConfig()

/*
 * Distributable (package) build.
 *
 * Emits the lean framework setup (`setups/index`) and each interface (UI)
 * module as SEPARATE ESM artifacts under `dist/`, so a consumer can import only
 * the modules it needs (`@epicurrents/interface`, `@epicurrents/interface/modules/eeg`,
 * …) without pulling the others into its bundle. Code shared between entries is
 * emitted once as a shared chunk; third-party dependencies are externalized.
 *
 * This is distinct from the two app/demo builds:
 *   - `vite.config.lib.ts`  — single all-in UMD bundle (`build/lib`), `setups/standalone`.
 *   - `vite.config.app.ts`  — the standalone web app (`build/app`).
 * Those bundle everything; this one is the consumer-facing, splittable package.
 */
export default defineConfig({
    mode: 'production',
    build: {
        // dist/ also holds the pre-built worker bundles (scripts/workers.mjs) and
        // copied vendor assets — never wipe them when emitting the package output.
        outDir: 'dist',
        emptyOutDir: false,
        // Ship readable source; consumers minify in their own application build.
        minify: false,
        target: 'esnext',
        // Bundle all component styles into a single stylesheet the consumer
        // imports once (`@epicurrents/interface/style.css`) — see assetFileNames.
        cssCodeSplit: false,
        rollupOptions: {
            // Keep each entry's exports intact — these are library entry points,
            // not app entries. Without this, rollup tree-shakes the exports away
            // (treating inputs as side-effect-only) and the package exports
            // resolve to empty modules.
            preserveEntrySignatures: 'strict',
            input: {
                // The framework setup — the package's default export ('.').
                'index': fileURLToPath(new URL('./src/setups/index.ts', import.meta.url)),
                // Per-modality interface modules — './modules/<name>'.
                'modules/eeg': fileURLToPath(new URL('./src/app/modules/eeg/index.ts', import.meta.url)),
                'modules/acc': fileURLToPath(new URL('./src/app/modules/acc/index.ts', import.meta.url)),
                'modules/doc': fileURLToPath(new URL('./src/app/modules/doc/index.ts', import.meta.url)),
                'modules/pdf': fileURLToPath(new URL('./src/app/modules/pdf/index.ts', import.meta.url)),
            },
            external: (id) => {
                // Bundle internal code: relative paths, path aliases (#…, @/…) and
                // already-resolved absolute source files. Externalize everything
                // else — i.e. bare third-party specifiers (vue, @epicurrents/*, …).
                if (id.startsWith('.') || id.startsWith('#') || id.startsWith('@/') || isAbsolute(id)) {
                    return false
                }
                return true
            },
            output: {
                format: 'es',
                entryFileNames: '[name].js',
                chunkFileNames: 'chunks/[name]-[hash].js',
                // Emit the single bundled stylesheet as a stable `dist/style.css`;
                // other assets (fonts, images) keep hashed names under assets/.
                assetFileNames: (info) =>
                    info.names?.some((n) => n.endsWith('.css'))
                        ? 'style.css'
                        : 'assets/[name]-[hash][extname]',
            },
        },
    },
    esbuild: {
        supported: {
            'top-level-await': true,
        },
        keepNames: true,
    },
    // Classic worker format — see vite.config.ts for the rationale.
    worker: {
        format: 'iife',
    },
    plugins: [
        tsconfigPaths(),
        vue({
            template: {
                compilerOptions: {
                    isCustomElement: ((tag) => {
                        return tag === 'log-inspector' || tag.startsWith('wa-')
                    }),
                },
            },
        }),
    ],
    define: {
        __INTLIFY_JIT_COMPILATION__: true,
    },
    resolve: {
        alias: {
            'node-fetch': 'isomorphic-fetch',
            stream: 'stream-browserify',
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
        preserveSymlinks: true,
    },
})
