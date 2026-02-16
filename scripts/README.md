# Interface Scripts

This folder contains utilities for setting up and managing Epicurrents package dependencies within the interface package's local development environment. These scripts clone the latest versions directly from GitHub or other git repositories into the `node_modules/@epicurrents` directory.

## Purpose

The scripts in this folder enable you to:

- **Setup** (`setup.mjs`): Complete setup workflow - clone, install, clean, and build all packages
- **Init** (`init.mjs`): Clone packages from GitHub repositories without installing/building
- **Install** (`install.mjs`): Install NPM dependencies for all packages
- **Clean** (`clean.mjs`): Remove duplicate dependencies to ensure version consistency
- **Build** (`build.mjs`): Build all packages from source
- **Update** (`update.mjs`): Pull the latest changes from GitHub for existing packages
- **Workers** (`workers.mjs`): Copy built worker files to the interface's dist directory

## Configuration

### The `packages` Array

The packages to manage are defined in [util.mjs](util.mjs) as a simple array. Each entry represents a single Epicurrents package to be cloned and built locally:

```javascript
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
```

### Package Configuration Options

Each package entry can have the following properties:

- **`name`** (required): Name of the package (will be cloned into `node_modules/@epicurrents/{name}`)
- **`branch`**: Git branch to check out (defaults to 'main')
- **`repository`**: Custom repository URL (if empty, uses `{repository}/{name}`)

### Customizing the Package List

To adjust which packages are set up:

1. Open [util.mjs](util.mjs)
2. Locate the `packages` array (around line 140)
3. Add, remove, or modify package entries as needed
4. For packages on a specific branch, add the `branch` property
5. For packages from a different repository, provide the full `repository` URL

**Example**: Adding a new package:

```javascript
export const packages = [
    { name: 'core', repository: '' },
    { name: 'my-new-module' },  // Add your package here
    { name: 'special-reader', branch: 'develop' },  // On a specific branch
    // ... more packages
]
```

## Running the Scripts

All scripts are executed via npm commands defined in [package.json](../package.json):

### Quick Start

For a complete setup of local dependencies from GitHub:

```bash
npm run setup
```

This single command clones, installs, cleans, and builds all packages in sequence.

### Alternative: Prepare Workflow

To update and rebuild existing local dependencies:

```bash
npm run deps:prepare
```

This runs: `update` → `install` → `clean` → `build` in sequence.

### Individual Commands

#### Setup (Complete Workflow)
```bash
npm run setup
```
Performs all steps in order: clone repositories, install dependencies, clean duplicates, and build packages. This is the recommended command for initial setup.

#### Initialize (Clone Only)
```bash
npm run deps:init
```
Clones packages from their Git repositories into `node_modules/@epicurrents` without installing or building. Useful when you want to manually control subsequent steps.

#### Update from Repository
```bash
npm run deps:update
```
Pulls the latest changes from GitHub for all existing packages. Checks out the specified branch if defined.

#### Install Dependencies
```bash
npm run deps:install
```
Installs NPM packages for all cloned dependencies.

#### Clean Dependencies
```bash
npm run deps:clean
```
Removes duplicate `@epicurrents` packages and event bus/log packages from each dependency's `node_modules` to ensure version consistency. This should be run after any NPM install operations.

#### Build from Source
```bash
npm run deps:build
```
Builds all packages from source using their respective build scripts.

#### Copy Workers
```bash
npm run copy:workers
```
Copies built worker files (`.worker.js`) from package UMD directories to the interface's `dist/workers` directory. This is automatically run by the `start` and `dev` commands.

## Important Notes

- **All-or-nothing**: Unlike the main scripts, these operate on all packages in the array — there's no scope filtering
- **Setup is comprehensive**: The `setup` command handles everything in one go (recommended for first-time setup)
- **Cleaning is critical**: Run `deps:clean` after installing new dependencies to prevent version conflicts
- **Core must be first**: The `core` package should always be the first entry in the `packages` array
- **Worker copying**: Workers are automatically copied when you run `npm start`, but can be manually triggered with `npm run copy:workers`
- **Local development**: These scripts install packages into `node_modules/@epicurrents`, allowing you to develop against the latest source code instead of published versions

## Package Installation Location

All packages are cloned into:
```
interface/node_modules/@epicurrents/{package-name}/
```

This allows the interface to use local development versions of Epicurrents packages instead of published npm packages.

## File Descriptions

- **`util.mjs`**: Shared utilities and the `packages` configuration array
- **`setup.mjs`**: Complete setup workflow (init → install → clean → build)
- **`init.mjs`**: Clones packages from Git repositories
- **`install.mjs`**: Installs NPM dependencies
- **`clean.mjs`**: Removes duplicate dependencies
- **`build.mjs`**: Builds packages from source
- **`update.mjs`**: Updates packages from their Git remotes
- **`workers.mjs`**: Copies worker files to the dist directory
- **`index.mjs`**: Exports utility functions for programmatic use
