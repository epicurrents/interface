/**
 * Tests for how a navigator item renders the main properties a resource reports.
 *
 * `getMainProperties()` returns a map whose key is sometimes a field name and sometimes the message
 * to display, with the value carrying either the field's value or the message's parameters. The
 * component branches on the key, and the branch it falls through to treats the key as a message —
 * so a field name that no branch names is rendered to the reader as the field name itself. That is
 * what happened to a collection's date, and these cases pin each branch against it.
 *
 * The component is driven through its options object rather than mounted: the suite has no
 * component-mounting dependency, and `resourceUpdated` touches nothing but the stub below.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import NavigatorItem from '#app/navigator/NavigatorItem.vue'
import { init } from '#i18n'
import type { MainProperty } from '@epicurrents/core/types'

type Rendered = { icon?: string, text?: string, tooltip?: string }

// The component is an options-API `defineComponent`, whose public type does not expose `methods`.
// Reaching for it is what lets the render logic be exercised without a mounting dependency.
const options = NavigatorItem as unknown as {
    methods: {
        $t: (key: string, params?: object, capitalized?: boolean) => string
        resourceUpdated: () => void
    }
}

// `T` answers with an empty string until i18n is initialised, which would make every assertion
// below pass for the wrong reason.
beforeAll(() => {
    init(createApp({}), 'en')
})

const render = (entries: [string, MainProperty][], isReady = true): Rendered[] => {
    const stub = {
        $options: { name: 'NavigatorItem' },
        $t: options.methods.$t,
        isReady: false,
        resource: { getMainProperties: () => new Map(entries), isReady },
        resourceProps: [] as Rendered[],
    }
    options.methods.resourceUpdated.call(stub)
    return stub.resourceProps
}

const DATE = new Date(2025, 2, 15, 13, 45)

describe('a date property', () => {
    it('renders the date rather than the name of the field holding it', () => {
        const [rendered] = render([['date', DATE]])
        expect(rendered.text).toBe('2025/3/15')
        expect(rendered.text).not.toBe('date')
    })
    it('carries the calendar icon and the full timestamp as its tooltip', () => {
        const [rendered] = render([['date', DATE]])
        expect(rendered.icon).toBe('calendar')
        expect(rendered.tooltip).toBe('Date: 2025/3/15 13:45')
    })
    it('follows the locale the application is set to, not the one the browser is', () => {
        // The point of rendering through the locale's own format. `toLocaleDateString` would answer
        // from the browser's settings, which a user who picked Finnish in the viewer never chose.
        try {
            init(createApp({}), 'fi')
            expect(render([['date', DATE]])[0].text).toBe('15.3.2025')
        } finally {
            init(createApp({}), 'en')
        }
    })
})

describe('the branches a date property must not disturb', () => {
    it('renders a duration as a short time string under the clock icon', () => {
        const [rendered] = render([['duration', 3661]])
        expect(rendered.icon).toBe('clock')
        expect(rendered.text).toBeTruthy()
        expect(rendered.tooltip?.startsWith('Duration: ')).toBe(true)
    })
    it('shows the signal count first, whatever order the map arrives in', () => {
        const rendered = render([['duration', 60], ['signals', 19]])
        expect(rendered[0].text).toBe('19')
        expect(rendered[0].icon).toBe('wave-pulse')
    })
    it('interpolates a message whose key carries placeholders', () => {
        const [rendered] = render([['Loading dependency {n}/{t}...', { n: 1, t: 2 }]])
        expect(rendered.text).toBe('Loading dependency 1/2...')
    })
    it('renders a plain state message, whose key is the message', () => {
        const [rendered] = render([['Initializing...', null]])
        expect(rendered.text).toBe('Initializing...')
    })
    it('answers a null page count with its own message', () => {
        const [rendered] = render([['pages', null]])
        expect(rendered.text).toBe('Not loaded yet')
    })
})

describe('readiness', () => {
    it('mirrors the resource state onto the item', () => {
        const stub = {
            $options: { name: 'NavigatorItem' },
            $t: options.methods.$t,
            isReady: false,
            resource: { getMainProperties: () => new Map(), isReady: true },
            resourceProps: [] as Rendered[],
        }
        options.methods.resourceUpdated.call(stub)
        expect(stub.isReady).toBe(true)
    })
})
