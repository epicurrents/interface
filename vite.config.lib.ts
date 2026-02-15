import { defineConfig } from 'vite'
import { dirname, resolve } from 'path'
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
        outDir: 'build',
        rollupOptions: {
            external: [],
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
        'process.env': process.env,
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
