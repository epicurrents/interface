import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
    plugins: [vue()],
    resolve: {
        // The package's own `imports` field maps `#*` onto `dist/*`, and Node subpath imports
        // resolve ahead of a *generic* alias — only an alias naming the same subpath wins. So each
        // first segment is listed explicitly; without that a test reads built output rather than
        // the source it is meant to cover, and cannot run at all before a build.
        alias: [
            { find: '#root/', replacement: fileURLToPath(new URL('./', import.meta.url)) },
            { find: '#workspace/', replacement: fileURLToPath(new URL('../', import.meta.url)) },
            { find: '#i18n', replacement: fileURLToPath(new URL('src/i18n', import.meta.url)) },
            { find: '#app', replacement: fileURLToPath(new URL('src/app', import.meta.url)) },
            { find: '#components', replacement: fileURLToPath(new URL('src/components', import.meta.url)) },
            { find: '#config', replacement: fileURLToPath(new URL('src/config', import.meta.url)) },
            { find: '#events', replacement: fileURLToPath(new URL('src/events', import.meta.url)) },
            { find: '#lib', replacement: fileURLToPath(new URL('src/lib', import.meta.url)) },
            { find: '#setups', replacement: fileURLToPath(new URL('src/setups', import.meta.url)) },
            { find: '#store', replacement: fileURLToPath(new URL('src/store', import.meta.url)) },
            { find: '#types', replacement: fileURLToPath(new URL('src/types', import.meta.url)) },
            { find: '#util', replacement: fileURLToPath(new URL('src/util', import.meta.url)) },
        ],
    },
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['tests/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reportsDirectory: 'tests/coverage',
        },
    },
})
