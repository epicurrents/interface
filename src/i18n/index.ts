/**
 * Epicurrents Interface internationalization main script.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { App } from "vue"
import { createI18n, I18n } from "vue-i18n"

import { messagesEN, datetimeUS } from "./locales/en"
import { messagesFI, datetimeFI } from "./locales/fi"

let i18n = null as null | I18n<any, any, any, boolean>

export const availableLocales = ['en', 'fi']

export const capitalize = (text: string) => {
    if (!text.length) {
        return text
    }
    return text.substring(0,1).toLocaleUpperCase() + text.substring(1)
}

/**
 * Initialize Vue-i18n module and return the initialized object.
 * @param vueInstance Vue instance to use the i18n in
 * @param locale desired active locale
 * @returns I18n
 */
export const init = (vueInstance: App, locale: string) => {
    // Initialization
    const messages = {
        en: messagesEN,
        fi: messagesFI,
    }
    const dateTimeFormats = {
        'en-US': datetimeUS,
        'fi-FI': datetimeFI,
    }
    i18n = createI18n({
        locale: locale,
        fallbackLocale: 'en',
        messages: messages,
        dateTimeFormats: dateTimeFormats,
        silentFallbackWarn: true,
        silentTranslationWarn: true,
    })
    vueInstance.use(i18n)
    return i18n
}

/**
 * Return a translation string for the given key, primarily from a
 * component-specific translation, secondarily from a general translation.
 * @param component name of the component (empty string or undefined for global)
 * @param key string to translate
 * @param params optional params
 */
 export const T = (key: string, component?: string | null, params?: object | null, capitalized?: boolean) => {
    if (key.length && i18n) {
        // @ts-ignore: These types are currently faulty and give an incorrect error if not ignored
        const specific = i18n.global.t(`components.${component}.${key}`, params)
        if (component && !specific.startsWith(`components.${component}`)) {
            return capitalized ? capitalize(specific) : specific
        } else {
            // This will use the key as a fallback if no general translation is found
            // @ts-ignore
            return capitalized ? capitalize(i18n.global.t(key, params)) : i18n.global.t(key, params)
        }
    } else {
        return ''
    }
}
