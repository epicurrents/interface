/**
 * Lead-field provider for the example setup — EXAMPLE ONLY.
 *
 * Reads a static lead-field bundle from `leadfields/` beside the served document: a `manifest.json`
 * and the content-hashed blobs it lists, in the layout the platform's compute app generates. For the
 * dev server that is `public/leadfields/`, which is git-ignored so each developer copies in the
 * bundle, or several to compare, without committing ten-megabyte blobs.
 *
 * A missing bundle, or a montage the manifest does not list, resolves to null and the tool reports
 * the lead field unavailable. A manifest listing a blob that cannot be read also resolves to null,
 * with a warning, because that bundle needs regenerating.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */
import type { LeadFieldData, LeadFieldProvider } from '#app/modules/eeg/types'

/** Relative, so the bundle resolves against the document wherever the interface is served from. */
const MANIFEST_PATH = 'leadfields/manifest.json'

/** One record of `manifest.json`, as the lead-field generator writes it. */
type LeadFieldManifestEntry = {
    montage_name:       string
    n_orient:           number
    grid_resolution_mm: number
    n_channels:         number
    n_sources:          number
    channel_names:      string[]
    /** Byte length of the lead-field section at the start of the blob. */
    lead_field_bytes:   number
    /** Byte length of the source-position section that follows it. */
    src_pos_bytes:      number
    /** Blob filename, resolved against the manifest's own location. */
    file:               string
}

type LeadFieldManifest = {
    entries:        LeadFieldManifestEntry[]
    format_version: number
}

/** Memoised as the promise, so concurrent first calls share one fetch. */
let _manifest: Promise<LeadFieldManifest | null> | null = null

const manifestUrl = () => new URL(MANIFEST_PATH, document.baseURI)

const loadManifest = (): Promise<LeadFieldManifest | null> => {
    _manifest ??= fetch(manifestUrl())
        .then(resp => (resp.ok ? resp.json() as Promise<LeadFieldManifest> : null))
        .catch(() => null)
    return _manifest
}

/** Split a blob into its lead-field and source-position float64 views, copying nothing. */
const sliceBlob = (buffer: ArrayBuffer, lfBytes: number, nSources: number): [Float64Array, Float64Array] => {
    const expected = lfBytes + nSources*3*8
    if (buffer.byteLength < expected) {
        throw new Error(
            `Lead field blob is truncated: got ${buffer.byteLength} bytes, expected at least ${expected}.`
        )
    }
    return [
        new Float64Array(buffer, 0, lfBytes/8),
        new Float64Array(buffer, lfBytes, nSources*3),
    ]
}

/**
 * Resolve a lead field from the bundle, matching all three parameters exactly: a different grid
 * spacing or orientation count describes a different source space, so a near miss is no answer.
 */
export const leadFieldProvider: LeadFieldProvider = async (
    montageName: string,
    nOrient:     number,
    gridResMm:   number,
): Promise<LeadFieldData | null> => {
    const manifest = await loadManifest()
    const entry = manifest?.entries.find(
        e => e.montage_name === montageName && e.n_orient === nOrient && e.grid_resolution_mm === gridResMm
    )
    if (!entry) {
        return null
    }
    try {
        const resp = await fetch(new URL(entry.file, manifestUrl()))
        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`)
        }
        const [leadField, srcPos] = sliceBlob(await resp.arrayBuffer(), entry.lead_field_bytes, entry.n_sources)
        return {
            leadField,
            srcPos,
            nChannels:    entry.n_channels,
            nSources:     entry.n_sources,
            nOrient:      entry.n_orient,
            channelNames: entry.channel_names,
        }
    } catch (e) {
        console.warn(
            `[leadFields] The bundle lists '${entry.file}' but it could not be read `
            + `(${(e as Error).message}); the bundle needs regenerating.`
        )
        return null
    }
}
