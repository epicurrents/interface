/**
 * Registration for the default application view, which is what the interface shows before any
 * other view has been activated.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */
import DefaultInterface from './DefaultInterface.vue'
import type { ApplicationView } from '#types/config'

const config: ApplicationView = {
    // This is a default view to use before any other view is activated.
    defaultTheme: 'light',
    description: 'Default view.',
    icon: '',
    label: 'Default',
    name: 'default',
    components: {
        controls: {
            visible: true,
        },
        footer: {
            visible: true,
        },
        navigator: {
            visible: true,
        },
    },
    theme: null,
}

export {
    /**
     * Default interface configuration.
     */
    config,
    /**
     * Default interface component.
     */
    DefaultInterface as InterfaceComponent,
}
