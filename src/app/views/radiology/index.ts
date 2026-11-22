/**
 * Registration for the radiology application view. The embedded viewer brings its own controls
 * and wants the full window width, which is why this view turns two of the shared components
 * off rather than leaving them to the active resource.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */
import RadiologyInterface from './RadiologyInterface.vue'
import type { ApplicationView } from '#types/config'

const config: ApplicationView = {
    defaultTheme: 'dark',
    description: 'Radiology data view.',
    icon: 'x-ray',
    label: 'Radiology',
    name: 'radiology',
    components: {
        // The framed viewer page has its own controls.
        controls: false,
        footer: {
            visible: null,
        },
        navigator: {
            // A radiology viewer page is laid out for the full window width, so the navigator is hidden by default.
            visible: false,
        },
    },
    theme: null,
}

export {
    /**
     * Media interface configuration.
     */
    config,
    /**
     * Media interface component.
     */
    RadiologyInterface as InterfaceComponent,
}
