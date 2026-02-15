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
