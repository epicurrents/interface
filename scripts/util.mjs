/**
 * Dependency utilities.
 */
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

export const sep = path.sep
export const rootDir = import.meta.dirname.replace(/[\\\/]dependencies$/, '')
const EPIC_MODULE_ROOT = [rootDir, 'node_modules', '@epicurrents'].join(sep)

/**
 * Original method from https://stackoverflow.com/a/52526549.
 */
export function deleteFolderRecursive (path) {
    if (fs.existsSync(path) && fs.lstatSync(path).isDirectory()) {
        fs.readdirSync(path).forEach((file) => {
            const curPath = [path, file].join(sep)
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath)
            } else {
                fs.unlinkSync(curPath)
            }
        });
        console.debug(`Deleting directory "${path}".`)
        fs.rmdirSync(path)
    } else if (!fs.existsSync(path)) {
        console.warn(`Directory ${path} does not exist.`)
    } else {
        console.warn(`${path} is not a directory.`)
    }
}
export function buildDependency (pkg, dir = EPIC_MODULE_ROOT) {
    const pkgDir = [dir, pkg.name].join(sep)
    if (!fs.existsSync(pkgDir) || !fs.lstatSync(pkgDir).isDirectory()) {
        console.warn(`Package ${pkg.name} directory does not exist, skipping.`)
        return
    }
    console.debug(`Building package ${pkg.name}.`)
    execSync(`cd ${pkgDir} && npm run build`, { stdio: 'inherit' }, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error: ${err}`)
            return
        }
        //console.debug(`Out: ${stdout}`)
        console.error(`Error: ${stderr}`)
    })
    console.debug(`Package ${pkg.name} built.`)
}
export function cleanDependency (pkg, dir = EPIC_MODULE_ROOT) {
    const pkgDir = [dir, pkg.name].join(sep)
    console.debug(`Deleting local dependencies from package ${pkg.name}.`)
    // Delete separate @epicurrents packages to guarantee version match across dependencies.
    const localCore = [pkgDir, 'node_modules', '@epicurrents'].join(sep)
    if (fs.existsSync(localCore) && fs.lstatSync(localCore).isDirectory()) {
        deleteFolderRecursive(localCore)
    }
    // Delete separate EventBus and Log packages so the global Log points to the same object.
    const localBus = [pkgDir, 'node_modules', 'scoped-event-bus'].join(sep)
    if (fs.existsSync(localBus) && fs.lstatSync(localBus).isDirectory()) {
        deleteFolderRecursive(localBus)
    }
    const localLog = [pkgDir, 'node_modules', 'scoped-event-log'].join(sep)
    if (fs.existsSync(localLog) && fs.lstatSync(localLog).isDirectory()) {
        deleteFolderRecursive(localLog)
    }
}
export function initDependency (pkg, dir = EPIC_MODULE_ROOT) {
    if (!fs.existsSync(dir)) {
        console.info(`Creating missing parent directory ${dir}.`)
        fs.mkdirSync(dir, { stdio: 'inherit' })
    }
    const pkgDir = [dir, pkg.name].join(sep)
    const pkgRepo = pkg.repository ? pkg.repository : `${repository}/${pkg.name}`
    if (fs.existsSync(pkgDir) && fs.lstatSync(pkgDir).isDirectory()) {
        console.info(`Package ${pkg.name} already exists, fetching from remote.`)
        execSync(`cd ${pkgDir} && git fetch --all`, { stdio: 'inherit' }, (err, stdout, stderr) => {
            if (err) {
                console.error(`Error: ${err}`)
                return
            }
            console.error(`Error: ${stderr}`)
        })
    } else {
        console.info(`Cloning package ${pkg.name}.`)
        execSync(`cd ${dir} && git clone ${pkgRepo}`, { stdio: 'inherit' }, (err, stdout, stderr) => {
            if (err) {
                console.error(`Error: ${err}`)
                return
            }
            console.error(`Error: ${stderr}`)
        })
    }
    // Checkout custom branch or main branch (in case we were on custom branch previously).
    const branch = pkg.branch || 'main'
    console.info(`Checking out branch ${branch} for package ${pkg.name}.`)
    execSync(`cd ${pkgDir} && git checkout ${branch}`, { stdio: 'inherit' }, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error: ${err}`)
            return
        }
        console.error(`Error: ${stderr}`)
    })
    console.info(`Pulling changes from remote.`)
    execSync(`cd ${pkgDir} && git pull --all`, { stdio: 'inherit' }, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error: ${err}`)
            return
        }
        console.error(`Error: ${stderr}`)
    })
}
export function installDependency (pkg, dir = EPIC_MODULE_ROOT) {
    const pkgDir = [dir, pkg.name].join(sep)
    if (!fs.existsSync(pkgDir) || !fs.lstatSync(pkgDir).isDirectory()) {
        console.warn(`Package ${pkg.name} directory does not exist, skipping.`)
        return
    }
    console.debug(`Installing dependencies for package ${pkg.name}.`)
    execSync(`cd ${pkgDir} && npm i`, { stdio: 'inherit' })
    console.debug(`Package ${pkg.name} dependencies installed.`)
}
export function updateDependency (pkg, dir = EPIC_MODULE_ROOT) {
    const pkgDir = [dir, pkg.name].join(sep)
    if (!fs.existsSync(pkgDir) || !fs.lstatSync(pkgDir).isDirectory()) {
        console.warn(`Package ${pkg} directory does not exist, skipping.`)
        return
    }
    console.debug(`Updating package ${pkg}.`)
    execSync(`cd ${pkgDir} && git pull`, { stdio: 'inherit' }, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error: ${err}`)
            return
        }
        console.error(`Error: ${stderr}`)
    })
    console.debug(`Package ${pkg} updated.`)
}

export const packages = [
    // Core.
    { name: 'core', repository: '' },
    // Resource modules.
    { name: 'doc-module', repository: '' },
    { name: 'eeg-module', repository: '' },
    // Source type readers.
    { name: 'edf-reader', branch: 'encoder', repository: '' },
    { name: 'htm-reader', repository: '' },
    { name: 'pdf-reader', repository: '' },
    // Services.
    { name: 'pyodide-service', repository: '' },
]

export const repository = 'https://github.com/epicurrents'
