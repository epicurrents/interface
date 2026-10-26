/**
 * The classes the application root carries for a view, which every element styled as part of the application
 * needs among its ancestors.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { ApplicationView } from '#types/config'

/**
 * The application root's classes for a view: the application class, the viewer theme and the Web Awesome theme. Content
 * shown outside the application root, as in a detached window, needs them to keep the application's styles.
 * @param view - The active view.
 */
export function appContextClass (view: Pick<ApplicationView, 'defaultTheme' | 'theme'>): string[] {
    const theme = view.theme || view.defaultTheme
    return ['epicv-app', `epicv-${theme}-theme`, `wa-${theme}`]
}
