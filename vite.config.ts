import { defineConfig } from 'vite'
import { resolve } from 'path'
import { fileURLToPath, URL } from 'url'
import { config as DotenvConfig } from 'dotenv'
import crossOriginIsolation from 'vite-plugin-cross-origin-isolation'
import tsconfigPaths from 'vite-tsconfig-paths'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// Load environment variables from .env file.
DotenvConfig()

process.env.SETUP_PATH = process.env.SETUP
                       ? 'setups/' + process.env.SETUP
                       : 'setups/default'
process.env.ASSET_PATH = process.env.ASSET_PATH || '/'
const EXCLUDE_MODULES = (process.env.EXCLUDE_MODULES || '').split(',')
                                                           .map(name => name.trim())
                                                           .filter(name => name.length > 0)
// Only display each excluded module once in the console, even if it is imported multiple times.
const excludedModules = new Set<string>()
// https://vitejs.dev/config/
export default defineConfig({
    base: process.env.ASSET_PATH,
    build: {
        lib: {
            // Could also be a dictionary or array of multiple entry points
            entry: resolve(__dirname, 'src/' + process.env.SETUP_PATH + '.ts'),
            name: 'Epicurrents',
            // the proper extensions will be added
            fileName: 'epicurrents-lib',
        },
        rollupOptions: {
            // make sure to externalize deps that shouldn't be bundled
            // into your library
            external: (id) => {
                for (const moduleName of EXCLUDE_MODULES) {
                    if (id === `vue` || id.startsWith(`vue/`)) {
                        return true
                    } else if (id.includes(`/app/modules/${moduleName}/`)) {
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
                // Provide global variables to use in the UMD build
                // for externalized deps
                globals: {
                    vue: 'Vue',
                },
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
        exclude: [
            "local",
        ],
        esbuildOptions: {
            target: 'esnext',
            keepNames: true,
            loader: {
                ".py": "text",
            }
        },
    },
    plugins: [
        crossOriginIsolation(),
        tsconfigPaths(),
        vue({
            template: {
                compilerOptions: {
                    isCustomElement: ((tag) => {
                        return tag === 'log-inspector' || tag.startsWith('wa-')
                    })
                }
            }
        }),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
            manifest: {
                name: 'Epicurrents',
                short_name: 'Epicurrents',
                description: 'A viewer for neurophysiological signal studies',
                theme_color: '#ffffff',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            }
        })
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        'node-fetch': 'isomorphic-fetch',
      },
      preserveSymlinks: true,
    },
})
