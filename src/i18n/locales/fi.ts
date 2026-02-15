/**
 * Epicurrents Interface Finnish locale master file.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import locApp from "./fi/App.json"

const messagesFI = {
    components: {
        App: locApp,
    },
    date: '{d}.{m}.{y}',
    datetime: '{d}.{m}.{y} {h}:{min}',
}

const datetimeFI = {
    short: {
        year: 'numeric', month: 'numeric', day: 'numeric',
    },
    long: {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: 'numeric',
    },
}

export default messagesFI
export { messagesFI, datetimeFI }
