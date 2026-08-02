import { defineConfig } from 'vite'
import { join, resolve } from 'path'
import { fileURLToPath, URL } from 'url'
import { config as DotenvConfig } from 'dotenv'
import tsconfigPaths from 'vite-tsconfig-paths'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Load environment variables from .env file.
DotenvConfig()

process.env.ASSET_PATH = process.env.ASSET_PATH || '/static/'
// Modality allowlist: names of the `src/app/modules/<name>/` UI dirs to include in the build. Empty means
// include every module (a full build); set e.g. `INCLUDE_MODULES=eeg` for a targeted distro and every other
// modality UI is externalised out of the bundle. Inverted from the former EXCLUDE_MODULES blocklist, which grew
// unwieldy as modules were added.
const INCLUDE_MODULES = (process.env.INCLUDE_MODULES || '')
                        .split(',')
                        .map(name => name.trim())
                        .filter(name => name.length > 0)
const SETUP_PATH = process.env.SETUP
                 ? 'setups/' + process.env.SETUP
                 : 'setups/standalone.example'
// Only display each excluded module once in the console, even if it is imported multiple times.
const excludedModules = new Set<string>()

export default defineConfig({
    base: process.env.ASSET_PATH,
    mode: 'production',
    build: {
        lib: {
            entry: resolve(__dirname, './src/' + SETUP_PATH + '.ts'),
            name: 'Epicurrents',
            fileName: 'epicurrents-lib',
        },
        minify: 'esbuild',
        outDir: join('build', 'lib'),
        rollupOptions: {
            external: (id) => {
                if (INCLUDE_MODULES.length) {
                    const match = id.match(/\/app\/modules\/([^/]+)\//)
                    if (match && !INCLUDE_MODULES.includes(match[1])) {
                        if (!excludedModules.has(id)) {
                            if (excludedModules.size === 0) {
                                // Finish the 'transforming...' log line to get messages on their own lines.
                                console.debug('')
                            }
                            console.warn(`✖ Excluding module '${match[1]}' from build (not in INCLUDE_MODULES).`)
                            excludedModules.add(id)
                        }
                        return true
                    }
                }
                return false
            },
            output: {
                globals: {},
            },
        },
        target: 'esnext',
    },
    esbuild: {
        supported: {
            'top-level-await': true,
        },
        keepNames: true,
    },
    optimizeDeps: {
        esbuildOptions: {
            target: 'esnext',
            keepNames: true,
        },
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
        viteSingleFile(),
    ],
    define: {
        __INTLIFY_JIT_COMPILATION__: true,
        'process.env.ASSET_PATH': JSON.stringify(process.env.ASSET_PATH),
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    },
    resolve: {
        alias: {
            'node-fetch': 'isomorphic-fetch',
            stream: "stream-browserify",
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
        preserveSymlinks: true,
    },
})
