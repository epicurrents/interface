import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: [
            { find: '#root/', replacement: fileURLToPath(new URL('./', import.meta.url)) },
            { find: '#workspace/', replacement: fileURLToPath(new URL('../', import.meta.url)) },
            // The package's own `imports` field maps `#*` onto `dist/*` and resolves ahead of a
            // generic alias, so without this a test would read built output rather than the source
            // it is meant to cover, and would need a prior build to run at all.
            { find: '#', replacement: fileURLToPath(new URL('src/', import.meta.url)) },
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
