// SPDX-License-Identifier: MIT
import type { WorkspaceTarget } from '@/lib/workspace/paths'
import { beginSuppressWatch, endSuppressWatch, noteSelfWrite } from '@/lib/workspace/watch'

export const MANIFEST_DIR = '.nesso'
export const MANIFEST_FILE = 'manifest.json'
export const MANIFEST_VERSION = 1

export interface GraphManifestEntry {
  id: string
  file: string
  name: string
  updatedAt: number
}

export interface WorkspaceManifest {
  version: number
  entries: Record<string, GraphManifestEntry>
}

// Module-level cache so every write operation (save, rename, delete) can update
// the manifest in memory and skip a re-read on the next write within the same
// session. Invalidated whenever the active workspace path changes.
let cachedWorkspace: string | null = null
let cachedManifest: WorkspaceManifest = { version: MANIFEST_VERSION, entries: {} }
/** Filenames (relative to workspace root) that exist on disk but cannot be
 *  loaded because their vocabulary or format is unsupported. All write paths
 *  must avoid overwriting these files. */
let cachedReservedPaths: string[] = []

export function getDiskSyncCache(): {
  workspace: string | null
  manifest: WorkspaceManifest
  reservedPaths: string[]
} {
  return {
    workspace: cachedWorkspace,
    manifest: cachedManifest,
    reservedPaths: cachedReservedPaths,
  }
}

export function setDiskSyncCache(
  workspace: string,
  manifest: WorkspaceManifest,
  reservedPaths?: string[],
): void {
  const workspaceChanged = cachedWorkspace !== null && cachedWorkspace !== workspace
  cachedWorkspace = workspace
  cachedManifest = manifest
  if (reservedPaths !== undefined) {
    cachedReservedPaths = reservedPaths
  } else if (workspaceChanged) {
    // Clear stale reservations from the previous workspace when the caller
    // omits them (the new workspace hasn't loaded its reserved paths yet).
    cachedReservedPaths = []
  }
}

async function fs() {
  return import('@tauri-apps/plugin-fs')
}

async function mkdirQuiet(path: string): Promise<void> {
  const { mkdir } = await fs()
  try {
    await mkdir(path, { recursive: true })
  } catch {
    /* already exists */
  }
}

export async function ensureWorkspace(ws: WorkspaceTarget): Promise<void> {
  await mkdirQuiet(ws.path(''))
  await mkdirQuiet(ws.path(MANIFEST_DIR))
}

export async function readManifest(ws: WorkspaceTarget): Promise<WorkspaceManifest> {
  const { readTextFile } = await fs()
  const file = ws.path(`${MANIFEST_DIR}/${MANIFEST_FILE}`)
  try {
    const raw = await readTextFile(file)
    const data = JSON.parse(raw) as WorkspaceManifest
    if (data?.entries && typeof data.entries === 'object') {
      return { version: data.version ?? MANIFEST_VERSION, entries: data.entries }
    }
  } catch {
    /* corrupt manifest — rebuild on next save */
  }
  return { version: MANIFEST_VERSION, entries: {} }
}

export async function writeManifest(
  ws: WorkspaceTarget,
  manifest: WorkspaceManifest,
): Promise<void> {
  const { readTextFile, writeTextFile } = await fs()
  await ensureWorkspace(ws)
  const file = ws.path(`${MANIFEST_DIR}/${MANIFEST_FILE}`)
  const content = JSON.stringify(manifest, null, 2)
  try {
    if ((await readTextFile(file)) === content) return
  } catch {
    /* missing manifest */
  }
  beginSuppressWatch()
  try {
    noteSelfWrite(file)
    await writeTextFile(file, content)
  } finally {
    endSuppressWatch()
  }
}

/** True when every changed path is only the workspace manifest (app-internal metadata). */
export function isManifestOnlyWatchPaths(paths: string[]): boolean {
  if (paths.length === 0) return false
  const suffix = `/${MANIFEST_DIR}/${MANIFEST_FILE}`
  return paths.every((p) => p.replace(/\\/g, '/').endsWith(suffix))
}

export function buildFileToIdMap(manifest: WorkspaceManifest): Map<string, string> {
  const map = new Map<string, string>()
  for (const entry of Object.values(manifest.entries)) {
    map.set(entry.file, entry.id)
  }
  return map
}

export function upsertManifestEntry(
  manifest: WorkspaceManifest,
  id: string,
  file: string,
  name: string,
  updatedAt: number,
): boolean {
  const entry = manifest.entries[id]
  if (entry && entry.file === file && entry.name === name && entry.updatedAt === updatedAt) {
    return false
  }
  manifest.entries[id] = { id, file, name, updatedAt }
  return true
}
