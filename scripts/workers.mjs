/**
 * Copy workers from either local or workspace to the build directory.
 */

import fs from 'fs'
import path from 'path'
import { rootDir } from './util.mjs'

const workerPaths = [
    //['node_modules', '@epicurrents', 'dicom-reader', 'umd'],
    ['node_modules', '@epicurrents', 'edf-reader', 'umd'],
    ['node_modules', '@epicurrents', 'htm-reader', 'umd'],
    ['node_modules', '@epicurrents', 'pdf-reader', 'umd'],
    ['node_modules', '@epicurrents', 'wav-reader', 'umd'],
    ['node_modules', '@epicurrents', 'pyodide-service', 'umd'],
    // Handle core last to overwrite workers copied from other packages.
    ['node_modules', '@epicurrents', 'core', 'umd'],
]

console.info('Copying workers...')
const dest = path.join(rootDir, 'dist', 'workers')
if (!fs.existsSync(path.join(rootDir, 'dist'))) {
    console.info(`Creating missing dist directory.`)
    fs.mkdirSync(path.join(rootDir, 'dist'))
}
if (!fs.existsSync(dest)) {
    console.info(`Creating missing workers directory.`)
    fs.mkdirSync(dest)
}
workerPaths.forEach(sourcePath => {
    const files = fs.readdirSync(path.join(rootDir, ...sourcePath))
    files.forEach(file => {
        if (file.endsWith('.worker.js')) {
            const filePath = path.join(rootDir, ...sourcePath, file)
            if (fs.existsSync(filePath)) {
                const pathParts = filePath.split(path.sep)
                const fileName = pathParts[pathParts.length - 1]
                const packageName = pathParts[pathParts.length - 3]
                console.info(`Copying worker ${packageName}/${fileName}.`)
                fs.copyFileSync(filePath, path.join(dest, fileName))
            }
        }
    })
})
console.info('Done copying workers.')
