/**
 * Registration for the biosignal application view: the view configuration the interface reads
 * when offering it, and the component that renders it.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */
import BiosignalInterface from './BiosignalInterface.vue'
import type { ApplicationView } from '#types/config'

const config: ApplicationView = {
    defaultTheme: 'light',
    description: 'Biosignal data view.',
    icon: 'pulse',
    label: 'Biosignal',
    name: 'biosignal',
    components: {
        controls: {
            visible: null,
        },
        footer: {
            visible: null,
        },
        navigator: {
            visible: null,
        },
    },
    theme: null,
}

export {
    /**
     * Biosignal interface configuration.
     */
    config,
    /**
     * Biosignal interface component.
     */
    BiosignalInterface as InterfaceComponent,
}
