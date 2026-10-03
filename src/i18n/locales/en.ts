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
    'Adjust speed between {min}-{max}': 'Adjust speed between {min}-{max}',
    'Channels: {count}. Length: {length} s. Sampling rate: {rate}.':
        'Channels: {count}. Length: {length} s. Sampling rate: {rate}.',
    'Choose a source channel for {labels}.': 'Choose a source channel for {labels}.',
    date: '{y}/{m}/{d}',
    datetime: '{y}/{m}/{d} {h}:{min}',
    'Dataset {n}': 'Dataset {n}',
    'Date: {d}': 'Date: {d}',
    'Day {d}': 'Day {d}',
    'Dipole ({x}, {y}, {z}) mm — GOF {gof}%': 'Dipole ({x}, {y}, {z}) mm — GOF {gof}%',
    'Document has a total of {n} pages': 'Document has a total of {n} pages',
    'Duration: {t}': 'Duration: {t}',
    'Lead field model for {montage} is not available on this server. Contact an administrator to compute it.':
        'Lead field model for {montage} is not available on this server. Contact an administrator to compute it.',
    'Loading studies from {c}...': 'Loading studies from {c}...',
    'Loading dependency {n}/{t}...': 'Loading dependency {n}/{t}...',
    'Loading module dependencies, please wait ({ready}/{total} done)...':
        'Loading module dependencies, please wait ({ready}/{total} done)...',
    'Memory use: {p} % ({u} / {t} MiB)': 'Memory use: {p} % ({u} / {t} MiB)',
    'Number {n}': 'Number {n}',
    'Peak at {t} ms': 'Peak at {t} ms',
    'Samples are clipped to {min} … {max} {unit}.': 'Samples are clipped to {min} … {max} {unit}.',
    'Send to {label}': 'Send to {label}',
    'Setting up montage {current} of {total}': 'Setting up montage {current} of {total}',
    'The recording is {duration} s long.': 'The recording is {duration} s long.',
    'Voltage / Δ ({unit})': 'Voltage / Δ ({unit})',
    'uV': 'µV', // Display ASCII-compatible unit uV in the interface as µV.
    welcome: {
        advanced: 'Advanced',
        basic: 'Basic',
        instruction: 'Read the below information carefully before proceeding.',
        login: 'Log in',
        medical: 'This software is designed solely for educational and scientific use. '
                 + 'It is not a medical device and may not be used for medical diagnostics.',
        notice: {
            default: 'By continuing you accept the disclaimer.',
            disclaimer: 'You must accept the disclaimer to use the application.',
            error: 'Login failed. Please check your username and password.',
            login: 'You must log in to use the application.',
        },
        password: 'Password',
        select: 'Select your name to log in',
        title: 'Welcome to Epicurrents!',
        username: 'Username',
        version: 'Choose the version to use. The advanced version offers more signal processing '
                 + 'tools but requires more resources from your device.',
        warranty: 'This is free software and is provided "as is". It comes with no warranty of any '
                  + 'kind. The authors of this software are not responsible for any damages or '
                  + 'losses caused by the use of this software.',
    },
    '{n} channels': '{n} channel | {n} channels',
    '{n} errors': '{n} error | {n} errors',
    '{n} pages': '{n} page | {n} pages',
    '{n} signals': '{n} signal | {n} signals',
    '{n} studies': '{n} study | {n} studies',
    '{n} tables': '{n} table | {n} tables',
    '{n} warnings': '{n} warning | {n} warnings',
    '{rate} Hz': '{rate} Hz',
    '{rate} Hz, as the destination requires.': '{rate} Hz, as the destination requires.',
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
