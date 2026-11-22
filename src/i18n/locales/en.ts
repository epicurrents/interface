/**
 * Epicurrents Interface English locale master file.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import locAccSynthesisTool from "./en/AccSynthesisTool.json"
import locApp from "./en/App.json"
import locBiosignalAnnotationSidebar from "./en/BiosignalAnnotationSidebar.json"
import locDatasetDialog from "./en/DatasetDialog.json"
import locDefaultFooter from "./en/DefaultFooter.json"
import locEegControls from "./en/EegControls.json"
import locEegFooter from "./en/EegFooter.json"
import locEegViewer from "./en/EegViewer.json"
import locExamineTool from "./en/ExamineTool.json"
import locFindingPicker from "./en/FindingPicker.json"
import locNavigatorEntry from "./en/NavigatorEntry.json"
import locNavigatorItem from "./en/NavigatorItem.json"
import locResourceGate from "./en/ResourceGate.json"
import locSignalExportDialog from "./en/SignalExportDialog.json"
import locSignalPropertiesTool from "./en/SignalPropertiesTool.json"
import locSourceLocalizationTool from "./en/SourceLocalizationTool.json"
import locWelcomeDialog from "./en/WelcomeDialog.json"

const messagesEN = {
    // A component's own messages, looked up first for keys translated in that component.
    components: {
        AccSynthesisTool: locAccSynthesisTool,
        App: locApp,
        BiosignalAnnotationSidebar: locBiosignalAnnotationSidebar,
        DatasetDialog: locDatasetDialog,
        DefaultFooter: locDefaultFooter,
        EegControls: locEegControls,
        EegFooter: locEegFooter,
        EegViewer: locEegViewer,
        ExamineTool: locExamineTool,
        FindingPicker: locFindingPicker,
        NavigatorEntry: locNavigatorEntry,
        NavigatorItem: locNavigatorItem,
        ResourceGate: locResourceGate,
        SignalExportDialog: locSignalExportDialog,
        SignalPropertiesTool: locSignalPropertiesTool,
        SourceLocalizationTool: locSourceLocalizationTool,
        WelcomeDialog: locWelcomeDialog,
    },
    // Formatted strings with properties need an entry, here or in the file of the one component that uses them.
    // The ones here are used in several components, or come from resources and are translated wherever shown.
    date: '{y}/{m}/{d}',
    datetime: '{y}/{m}/{d} {h}:{min}',
    'Day {d}': 'Day {d}',
    'Lead field model for {montage} is not available on this server. Contact an administrator to compute it.':
        'Lead field model for {montage} is not available on this server. Contact an administrator to compute it.',
    'Loading dependency {n}/{t}...': 'Loading dependency {n}/{t}...',
    'Loading {name} failed.': 'Loading {name} failed.',
    'Loading {name} failed: {reason}': 'Loading {name} failed: {reason}',
    'Number {n}': 'Number {n}',
    'uV': 'µV', // Display ASCII-compatible unit uV in the interface as µV.
    '{n} channels': '{n} channel | {n} channels',
    '{n} studies': '{n} study | {n} studies',
    '{n} tables': '{n} table | {n} tables',
}

const datetimeUS = {
    short: {
        year: 'numeric', month: 'numeric', day: 'numeric',
    },
    long: {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: 'numeric',
    },
}

export default messagesEN
export { messagesEN, datetimeUS }
