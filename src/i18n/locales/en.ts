/**
 * Epicurrents Interface English locale master file.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import locApp from "./en/App.json"
import locEegViewer from "./en/EegViewer.json"
import locExamineTool from "./en/ExamineTool.json"

const messagesEN = {
    components: {
        App: locApp,
        EegViewer: locEegViewer,
        ExamineTool: locExamineTool,
    },
    // Formatted strings with properties must be declared here.
    date: '{y}/{m}/{d}',
    datetime: '{y}/{m}/{d} {h}:{min}',
    'Dataset {n}': 'Dataset {n}',
    'Day {d}': 'Day {d}',
    'Duration: {t}': 'Duration: {t}',
    'Loading studies from {c}...': 'Loading studies from {c}...',
    'Loading dependency {n}/{t}...': 'Loading dependency {n}/{t}...',
    'Memory use: {p} % ({u} / {t} MiB)': 'Memory use: {p} % ({u} / {t} MiB)',
    'Number {n}': 'Number {n}',
    'uV': 'µV', // Display ASCII-compatible unit uV in the interface as µV.
    welcome: {
        accept: 'I accept',
        notice: {
            disclaimer: 'You must accept the disclaimer to use the application.',
            error: 'Login failed. Please check your username and password.',
            login: 'You must log in to use the application.',
        },
        instruction: 'Read the below information carefully before proceeding.',
        login: 'Log in',
        medical: 'This software is designed solely for educational and scientific use. It is not a medical device and may not be used for medical diagnostics.',
        password: 'Password',
        select: 'Select your name to log in',
        title: 'Welcome to Epicurrents!',
        username: 'Username',
        warranty: 'This is free software and is provided "as is". It comes with no warranty of any kind. The authors of this software are not responsible for any damages or losses caused by the use of this software.',
    },
    '{n} channels': '{n} channel | {n} channels',
    '{n} errors': '{n} error | {n} errors',
    '{n} pages': '{n} page | {n} pages',
    '{n} signals': '{n} signal | {n} signals',
    '{n} studies': '{n} study | {n} studies',
    '{n} tables': '{n} table | {n} tables',
    '{n} warnings': '{n} warning | {n} warnings',
    '{value} {unit}': '{value} {unit}',
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
