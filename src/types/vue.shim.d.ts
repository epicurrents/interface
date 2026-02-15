/**
 * Epicurrents Interface Vue shims.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

declare module '*.vue' {
    import { defineComponent } from "vue"
    const Component: ReturnType<typeof defineComponent>
    export default Component
}

import { EpiCStore } from "#store"
import type { EpicurrentsApp, RuntimeState } from "@epicurrents/core/types"
import type { ScopedEventBus } from "scoped-event-bus/types"
declare module '@vue/runtime-core' {
    interface ComponentCustomProperties {
        /**
         * Provides a reference to the application configuration.
         */
        $config: ApplicationInterfaceConfig
        /**
         * Provides a reference to Epicurrents instance.
         */
        $epicurrents: EpicurrentsApp
        /**
         * Provides a reference to the Epicurrents event bus.
         */
        $eventBus: ScopedEventBus
        /**
         * Provides a reference to the interface module.
         */
        $interface: InterfaceModule
        /**
         * Provides a reference to the Epicurrents application state manager.
         */
        $runtime: RuntimeState
        /**
         * Provides a reference to the Vuex store.
         */
        $store: EpiCStore
        /**
         * This property contains the style module classes as { [className]: generatedId }, where style modules
         * are used in the component.
         * @example
         * <style module>
         *   .important {
         *      font-weight: bold;
         *   }
         * </style>
         * ...
         * <template>
         *   <span :class="$style.important">Important!</style>
         * </template>
         * ...
         * <script>
         *   let className = this.$style.important // Some generated ID string
         * </script>
         */
        $style: { [className: string]: string }
    }
}
