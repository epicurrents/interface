/**
 * Material Symbols — bundled SVG assets.
 * Each icon is imported as a raw string (?raw) so Vite inlines it into the
 * build output regardless of build format (app, lib, or UMD / singlefile).
 * The resolver in AppIcon.vue converts these strings to data: URIs at runtime.
 *
 * Material Symbols are copyright Google LLC and licensed under the
 * Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0).
 *
 * Outlined (used for variant="regular" | "light" | "brand")
 *
 * To add new icons: import the SVG asset, add it to the ICON_SVGS table, and if needed, add a mapping from the
 * FontAwesome (WebAwesome's default icon library) name to the Material name in FA_TO_MATERIAL.
 *
 * This file can be used as a template for adding more icon libraries in the future, if needed. The resolver can be
 * extended to support multiple libraries and the icon name can be used to determine which library to pull from.
 */

// outlined
import add from '@material-symbols/svg-400/outlined/add.svg?raw'
import biotech from '@material-symbols/svg-400/outlined/biotech.svg?raw'
import bookmark_add from '@material-symbols/svg-400/outlined/bookmark_add.svg?raw'
import cancel from '@material-symbols/svg-400/outlined/cancel.svg?raw'
import chat from '@material-symbols/svg-400/outlined/chat.svg?raw'
import chat_bubble from '@material-symbols/svg-400/outlined/chat_bubble.svg?raw'
import check from '@material-symbols/svg-400/outlined/check.svg?raw'
import check_circle from '@material-symbols/svg-400/outlined/check_circle.svg?raw'
import chevron_left from '@material-symbols/svg-400/outlined/chevron_left.svg?raw'
import chevron_right from '@material-symbols/svg-400/outlined/chevron_right.svg?raw'
import close from '@material-symbols/svg-400/outlined/close.svg?raw'
import close_fullscreen from '@material-symbols/svg-400/outlined/close_fullscreen.svg?raw'
import cloud_download from '@material-symbols/svg-400/outlined/cloud_download.svg?raw'
import create_new_folder from '@material-symbols/svg-400/outlined/create_new_folder.svg?raw'
import dangerous from '@material-symbols/svg-400/outlined/dangerous.svg?raw'
import delete_ from '@material-symbols/svg-400/outlined/delete.svg?raw'
import description from '@material-symbols/svg-400/outlined/description.svg?raw'
import download from '@material-symbols/svg-400/outlined/download.svg?raw'
import drag_indicator from '@material-symbols/svg-400/outlined/drag_indicator.svg?raw'
import edit from '@material-symbols/svg-400/outlined/edit.svg?raw'
import error from '@material-symbols/svg-400/outlined/error.svg?raw'
import folder from '@material-symbols/svg-400/outlined/folder.svg?raw'
import format_underlined from '@material-symbols/svg-400/outlined/format_underlined.svg?raw'
import fullscreen from '@material-symbols/svg-400/outlined/fullscreen.svg?raw'
import fullscreen_exit from '@material-symbols/svg-400/outlined/close_fullscreen.svg?raw'
import help from '@material-symbols/svg-400/outlined/help.svg?raw'
import info from '@material-symbols/svg-400/outlined/info.svg?raw'
import keyboard_arrow_down from '@material-symbols/svg-400/outlined/keyboard_arrow_down.svg?raw'
import keyboard_arrow_up from '@material-symbols/svg-400/outlined/keyboard_arrow_up.svg?raw'
import keyboard_double_arrow_left from '@material-symbols/svg-400/outlined/keyboard_double_arrow_left.svg?raw'
import keyboard_double_arrow_right from '@material-symbols/svg-400/outlined/keyboard_double_arrow_right.svg?raw'
import library_add from '@material-symbols/svg-400/outlined/library_add.svg?raw'
import link from '@material-symbols/svg-400/outlined/link.svg?raw'
import manage_search from '@material-symbols/svg-400/outlined/manage_search.svg?raw'
import memory from '@material-symbols/svg-400/outlined/memory.svg?raw'
import menu from '@material-symbols/svg-400/outlined/menu.svg?raw'
import menu_book from '@material-symbols/svg-400/outlined/menu_book.svg?raw'
import more_horiz from '@material-symbols/svg-400/outlined/more_horiz.svg?raw'
import more_vert from '@material-symbols/svg-400/outlined/more_vert.svg?raw'
import open_in_full from '@material-symbols/svg-400/outlined/open_in_full.svg?raw'
import open_in_new from '@material-symbols/svg-400/outlined/open_in_new.svg?raw'
import pause from '@material-symbols/svg-400/outlined/pause.svg?raw'
import play_arrow from '@material-symbols/svg-400/outlined/play_arrow.svg?raw'
import redo from '@material-symbols/svg-400/outlined/redo.svg?raw'
import remove from '@material-symbols/svg-400/outlined/remove.svg?raw'
import save from '@material-symbols/svg-400/outlined/save.svg?raw'
import schedule from '@material-symbols/svg-400/outlined/schedule.svg?raw'
import search from '@material-symbols/svg-400/outlined/search.svg?raw'
import settings from '@material-symbols/svg-400/outlined/settings.svg?raw'
import skip_previous from '@material-symbols/svg-400/outlined/skip_previous.svg?raw'
import text_fields from '@material-symbols/svg-400/outlined/text_fields.svg?raw'
import tune from '@material-symbols/svg-400/outlined/tune.svg?raw'
import undo from '@material-symbols/svg-400/outlined/undo.svg?raw'
import unfold_less from '@material-symbols/svg-400/outlined/unfold_less.svg?raw'
import unfold_more from '@material-symbols/svg-400/outlined/unfold_more.svg?raw'
import videocam from '@material-symbols/svg-400/outlined/videocam.svg?raw'
import vital_signs from '@material-symbols/svg-400/outlined/vital_signs.svg?raw'
import warning from '@material-symbols/svg-400/outlined/warning.svg?raw'

// filled (used for variant="solid")
import dangerous_filled from '@material-symbols/svg-400/outlined/dangerous-fill.svg?raw'
import warning_filled from '@material-symbols/svg-400/outlined/warning-fill.svg?raw'

import { registerIconLibrary } from '@awesome.me/webawesome'

/** Lookup table: materialName → { outlined: svgString, filled?: svgString } */
export const ICON_SVGS: Record<string, { outlined: string; filled?: string }> = {
    add:                            { outlined: add },
    biotech:                        { outlined: biotech },
    bookmark_add:                   { outlined: bookmark_add },
    cancel:                         { outlined: cancel },
    chat:                           { outlined: chat },
    chat_bubble:                    { outlined: chat_bubble },
    check:                          { outlined: check },
    check_circle:                   { outlined: check_circle },
    chevron_left:                   { outlined: chevron_left },
    chevron_right:                  { outlined: chevron_right },
    close:                          { outlined: close },
    close_fullscreen:               { outlined: close_fullscreen },
    cloud_download:                 { outlined: cloud_download },
    create_new_folder:              { outlined: create_new_folder },
    dangerous:                      { outlined: dangerous, filled: dangerous_filled },
    delete:                         { outlined: delete_ },
    description:                    { outlined: description },
    download:                       { outlined: download },
    drag_indicator:                 { outlined: drag_indicator },
    edit:                           { outlined: edit },
    error:                          { outlined: error },
    folder:                         { outlined: folder },
    format_underlined:              { outlined: format_underlined },
    fullscreen:                     { outlined: fullscreen },
    fullscreen_exit:                { outlined: fullscreen_exit },
    help:                           { outlined: help },
    info:                           { outlined: info },
    keyboard_arrow_down:            { outlined: keyboard_arrow_down },
    keyboard_arrow_up:              { outlined: keyboard_arrow_up },
    keyboard_double_arrow_left:     { outlined: keyboard_double_arrow_left },
    keyboard_double_arrow_right:    { outlined: keyboard_double_arrow_right },
    library_add:                    { outlined: library_add },
    link:                           { outlined: link },
    manage_search:                  { outlined: manage_search },
    memory:                         { outlined: memory },
    menu:                           { outlined: menu },
    menu_book:                      { outlined: menu_book },
    more_horiz:                     { outlined: more_horiz },
    more_vert:                      { outlined: more_vert },
    open_in_full:                   { outlined: open_in_full },
    open_in_new:                    { outlined: open_in_new },
    pause:                          { outlined: pause },
    play_arrow:                     { outlined: play_arrow },
    redo:                           { outlined: redo },
    remove:                         { outlined: remove },
    save:                           { outlined: save },
    schedule:                       { outlined: schedule },
    search:                         { outlined: search },
    settings:                       { outlined: settings },
    skip_previous:                  { outlined: skip_previous },
    text_fields:                    { outlined: text_fields },
    tune:                           { outlined: tune },
    undo:                           { outlined: undo },
    unfold_less:                    { outlined: unfold_less },
    unfold_more:                    { outlined: unfold_more },
    videocam:                       { outlined: videocam },
    vital_signs:                    { outlined: vital_signs },
    warning:                        { outlined: warning, filled: warning_filled },
}

/**
 * Maps Font Awesome (WA default library) icon names (kebab-case) to Material Symbols names (snake_case).
 * Included here as a compatibility shim — callers may use either naming convention.
 */
const FA_TO_MATERIAL: Record<string, string> = {
    'angle-down':                       'keyboard_arrow_down',
    'angle-up':                         'keyboard_arrow_up',
    'arrow-down-to-arc':                'format_underlined',
    'arrow-up-right-from-square':       'open_in_new',
    'arrows-from-dotted-line':          'unfold_more',
    'arrows-maximize':                  'fullscreen',
    'arrows-minimize':                  'fullscreen_exit',
    'arrows-to-dotted-line':            'unfold_less',
    'backward-fast':                    'skip_previous',
    'bars':                             'menu',
    'book':                             'menu_book',
    'bookmark-plus':                    'bookmark_add',
    'check':                            'check',
    'check-circle':                     'check_circle',
    'chevron-down':                     'keyboard_arrow_down',
    'chevron-left':                     'chevron_left',
    'chevron-right':                    'chevron_right',
    'chevron-up':                       'keyboard_arrow_up',
    'chevrons-left':                    'keyboard_double_arrow_left',
    'chevrons-right':                   'keyboard_double_arrow_right',
    'circle-check':                     'check_circle',
    'circle-exclamation':               'error',
    'circle-info':                      'info',
    'circle-question':                  'help',
    'circle-x':                         'cancel',
    'clock':                            'schedule',
    'cloud-arrow-down':                 'cloud_download',
    'compress':                         'close_fullscreen',
    'ellipsis':                         'more_horiz',
    'ellipsis-horizontal':              'more_horiz',
    'ellipsis-vertical':                'more_vert',
    'exclamation-circle':               'error',
    'exclamation-octagon':              'dangerous',
    'exclamation-triangle':             'warning',
    'expand':                           'open_in_full',
    'file':                             'description',
    'file-lines':                       'description',
    'floppy-disk':                      'save',
    'folder':                           'folder',
    'folder-arrow-down':                'download',
    'folder-plus':                      'create_new_folder',
    'gear':                             'settings',
    'grip-dots-vertical':               'drag_indicator',
    'info-circle':                      'info',
    'input-text':                       'text_fields',
    'link':                             'link',
    'magnifying-glass-waveform':        'manage_search',
    'message-dots':                     'chat',
    'message-middle':                   'chat_bubble',
    'microchip':                        'memory',
    'minus':                            'remove',
    'octagon-exclamation':              'dangerous',
    'pause':                            'pause',
    'pencil':                           'edit',
    'play':                             'play_arrow',
    'plus':                             'add',
    'pulse':                            'vital_signs',
    'rectangle-history-circle-plus':    'library_add',
    'redo':                             'redo',
    'search':                           'search',
    'square-question':                  'help',
    'trash':                            'delete',
    'triangle-exclamation':             'warning',
    'undo':                             'undo',
    'video-camera':                     'videocam',
    'wave-pulse':                       'vital_signs',
    'x-ray':                            'biotech',
    'xmark':                            'close',
}

/** Maps WA/FA variant names to Material Symbols subfolder names. */
const VARIANT_TO_FOLDER: Record<string, string> = {
    'solid':   'filled',
    'regular': 'outlined',
    'light':   'outlined',
    'brand':   'outlined',
}

/**
 * Register Material Symbols as the epicurrents icon library.
 * The resolver receives (name, family, variant) from wa-icon and returns the SVG asset URL.
 * FA names (kebab-case) are translated to Material Symbols names (snake_case) automatically.
 */
export function registerIcons() {
    // When embedded in the platform, use its WebAwesome instance so the icon
    // library is registered into the same registry that wa-icon reads from.
    // Fall back to the bundled copy when running standalone (dev server).
    const register = (window as any).__EPICURRENTS__?.registerIconLibrary ?? registerIconLibrary
    register('epicurrents', {
        resolver: (name: string, _family: string, variant: string) => {
            const useFilled = (VARIANT_TO_FOLDER[variant] ?? 'outlined') === 'filled'
            const materialName = FA_TO_MATERIAL[name] ?? name
            const entry = ICON_SVGS[materialName]
            if (!entry) {
                return ''
            }
            const svg = (useFilled && entry.filled) ? entry.filled : entry.outlined
            return svgToDataUri(svg)
        },
        mutator: (svg: SVGElement) => svg.setAttribute('fill', 'currentColor'),
    })
}

/** Convert a raw SVG string to a data: URI suitable for use in fetch() or img src. */
export function svgToDataUri (svg: string): string {
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
