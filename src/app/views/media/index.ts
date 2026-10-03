/**
 * Registration for the media application view: the view configuration the interface reads when
 * offering it, and the component that renders it.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */
import MediaInterface from './MediaInterface.vue'
import type { ApplicationView } from '#types/config'

const config: ApplicationView = {
    defaultTheme: 'light',
    description: 'Media data view.',
    icon: 'video-camera',
    label: 'Media',
    name: 'media',
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
     * Media interface configuration.
     */
    config,
    /**
     * Media interface component.
     */
    MediaInterface as InterfaceComponent,
}
