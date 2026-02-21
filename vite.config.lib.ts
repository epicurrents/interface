import { defineConfig } from 'vite'
import { join, resolve } from 'path'
import { fileURLToPath, URL } from 'url'
import { config as DotenvConfig } from 'dotenv'
import tsconfigPaths from 'vite-tsconfig-paths'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Load environment variables from .env file.
DotenvConfig()

process.env.SETUP_PATH = process.env.SETUP
                       ? 'setups/' + process.env.SETUP
                       : 'setups/default'
process.env.ASSET_PATH = process.env.ASSET_PATH || '/static/'
const EXCLUDE_MODULES = (process.env.EXCLUDE_MODULES || '').split(',')
                                                           .map(name => name.trim())
                                                           .filter(name => name.length > 0)
// Only display each excluded module once in the console, even if it is imported multiple times.
const excludedModules = new Set<string>()

export default defineConfig({
    base: process.env.ASSET_PATH,
    mode: 'production',
    build: {
        lib: {
            entry: resolve(__dirname, './src/' + process.env.SETUP_PATH + '.ts'),
            name: 'Epicurrents',
            fileName: 'epicurrents-lib',
        },
        minify: 'esbuild',
        outDir: join('build', 'lib'),
        rollupOptions: {
            external: (id) => {
                for (const moduleName of EXCLUDE_MODULES) {
                    if (id.includes(`/app/modules/${moduleName}/`)) {
                        if (!excludedModules.has(id)) {
                            if (excludedModules.size === 0) {
                                // Finish the 'transforming...' log line to get messages on their own lines.
                                console.debug('')
                            }
                            console.warn(`✖ Excluding module '${moduleName}' from build.`)
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
        'process.env.SETUP_PATH': JSON.stringify(process.env.SETUP_PATH),
        'process.env.ASSET_PATH': JSON.stringify(process.env.ASSET_PATH),
        'process.env.EXCLUDE_MODULES': JSON.stringify(process.env.EXCLUDE_MODULES),
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
