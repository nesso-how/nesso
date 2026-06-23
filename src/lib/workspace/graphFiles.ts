// SPDX-License-Identifier: MIT
import type { GraphRecord } from '@/store/db'
import type { NessoGraphFile } from '@nesso-how/formats'
import type { NessoSettings } from '@/types/graph'
import { graphPersistPayload } from '@/lib/graphPersist'
import { defaultGraphDisplay } from '@/types/graph'
import { serializeGraph, deserializeGraph } from '@nesso-how/formats'
import { VOCABULARY } from '@nesso-how/vocab-learning'
import { fillConceptNodeParams } from '@/data/conceptNodes'
import { isGraphId, newGraphId } from '@/lib/graphId'
import {
  buildFileToIdMap,
  getDiskSyncCache,
  MANIFEST_FILE,
  readManifest,
  setDiskSyncCache,
  upsertManifestEntry,
  writeManifest,
  ensureWorkspace,
  type GraphManifestEntry,
  type WorkspaceManifest,
} from '@/lib/workspace/manifest'
import type { WorkspaceTarget } from '@/lib/workspace/paths'
import { resolveWorkspace } from '@/lib/workspace/paths'
import { beginSuppressWatch, endSuppressWatch, noteSelfWrite } from '@/lib/workspace/watch'
import { grantFsScope } from '@/lib/workspace/scope'

/** Filename stem from graph title — keeps spaces; strips path-forbidden characters only. */
export function filenameBaseFromName(name: string): string {
  const base = name.trim().replace(/[/\\?%*:|"<>]/g, '-')
  return base || 'graph'
}

export function graphNameFromFilename(filename: string): string {
  return filename.replace(/\.json$/i, '').trim() || 'Untitled'
}

/** Next unused display name (`Foo`, `Foo-2`, `Foo-3`, …) matching workspace filename stems. */
export function uniqueGraphNameAmong(name: string, usedNames: Iterable<string>): string {
  const base = name.trim() || 'graph'
  const key = (n: string) => n.trim().toLowerCase()
  const used = new Set([...usedNames].map(key))
  if (!used.has(key(base))) return base
  let n = 2
  while (used.has(key(`${base}-${n}`))) n++
  return `${base}-${n}`
}

/** If JSON `name` differs from the file basename, the basename wins (updates JSON on read). */
function resolveGraphName(
  file: NessoGraphFile,
  filename: string,
): { name: string; patched: boolean } {
  const fromFilename = graphNameFromFilename(filename)
  const jsonName = file.name?.trim() ?? ''
  if (jsonName !== fromFilename) {
    return { name: fromFilename, patched: true }
  }
  return { name: jsonName || fromFilename, patched: false }
}

/**
 * Graph id: manifest binding → valid `id` in JSON → new random id.
 *
 * `claimedIds` tracks ids already bound to a file — pre-seeded from the
 * manifest and grown as files are scanned — so a copied/duplicated file that
 * embeds an id already spoken for gets a fresh id instead of colliding with
 * (and silently merging into) the original, regardless of scan order.
 */
function resolveGraphId(
  file: NessoGraphFile,
  filename: string,
  fileToId: Map<string, string>,
  claimedIds: Set<string>,
): string {
  const fromManifest = fileToId.get(filename)
  if (fromManifest) return fromManifest

  const fileId = file.id?.trim()
  if (fileId && isGraphId(fileId) && !claimedIds.has(fileId)) return fileId

  return newGraphId()
}

async function fs() {
  return import('@tauri-apps/plugin-fs')
}

function uniqueFilename(base: string, manifest: WorkspaceManifest, excludeId?: string): string {
  let candidate = `${base}.json`
  let n = 2
  const used = new Set(
    Object.values(manifest.entries)
      .filter((e) => e.id !== excludeId)
      .map((e) => e.file),
  )
  while (used.has(candidate)) {
    candidate = `${base}-${n}.json`
    n++
  }
  return candidate
}

export function recordToGraphFile(record: GraphRecord): string {
  const { nodes, edges, display } = graphPersistPayload(
    record.nodes,
    record.edges,
    record.display ?? defaultGraphDisplay(),
  )
  return serializeGraph({
    vocabulary: { id: VOCABULARY.id, version: VOCABULARY.version },
    id: record.id,
    updatedAt: record.updatedAt,
    name: record.name,
    nodes,
    edges,
    display,
  })
}

async function alignEntryFileToName(
  ws: WorkspaceTarget,
  record: GraphRecord,
  manifest: WorkspaceManifest,
  entry: GraphManifestEntry,
  fileToId: Map<string, string>,
): Promise<void> {
  const expectedFile = uniqueFilename(filenameBaseFromName(record.name), manifest, record.id)
  if (entry.file === expectedFile) return

  const { rename } = await fs()
  const oldPath = ws.path(entry.file)
  const newPath = ws.path(expectedFile)
  beginSuppressWatch()
  try {
    noteSelfWrite(oldPath, newPath)
    await rename(oldPath, newPath).catch(() => {})
  } finally {
    endSuppressWatch()
  }
  fileToId.delete(entry.file)
  entry.file = expectedFile
  fileToId.set(expectedFile, record.id)
}

/** When a loaded graph title collides with peers, suffix the name and rename the file to match. */
export async function applyUniqueGraphNameOnDisk(
  ws: WorkspaceTarget,
  filename: string,
  record: GraphRecord,
  peerNames: Iterable<string>,
  manifest: WorkspaceManifest,
  fileToId: Map<string, string>,
): Promise<{ file: string; record: GraphRecord }> {
  const unique = uniqueGraphNameAmong(record.name, peerNames)
  if (unique === record.name) return { file: filename, record }
  const updated: GraphRecord = { ...record, name: unique, updatedAt: Date.now() }
  const file = await relocateGraphFile(ws, filename, updated, manifest, fileToId)
  return { file, record: { ...updated, name: graphNameFromFilename(file) } }
}

async function relocateGraphFile(
  ws: WorkspaceTarget,
  currentFile: string,
  record: GraphRecord,
  manifest: WorkspaceManifest,
  fileToId: Map<string, string>,
): Promise<string> {
  const targetFile = uniqueFilename(filenameBaseFromName(record.name), manifest, record.id)
  const finalName = graphNameFromFilename(targetFile)
  if (targetFile === currentFile) return currentFile

  const { rename, writeTextFile, remove } = await fs()
  const newPath = ws.path(targetFile)
  const content = recordToGraphFile({ ...record, name: finalName })
  beginSuppressWatch()
  try {
    noteSelfWrite(ws.path(currentFile), newPath)
    try {
      // Prefer rename (atomic on most FS) to preserve metadata; fall back to
      // write + remove on cross-device or permission failures.
      await rename(ws.path(currentFile), newPath)
    } catch {
      await remove(ws.path(currentFile)).catch(() => {})
    }
    // Always overwrite content after the move so the file reflects the current record.
    await writeTextFile(newPath, content)
  } finally {
    endSuppressWatch()
  }
  fileToId.delete(currentFile)
  fileToId.set(targetFile, record.id)
  return targetFile
}

export async function saveGraphToDisk(
  ws: WorkspaceTarget,
  record: GraphRecord,
  manifest: WorkspaceManifest,
  fileToId: Map<string, string>,
): Promise<{ manifest: WorkspaceManifest; record: GraphRecord }> {
  const { writeTextFile } = await fs()
  await ensureWorkspace(ws)
  let entry = manifest.entries[record.id]
  let saved = record
  if (!entry) {
    const file = uniqueFilename(filenameBaseFromName(record.name), manifest, record.id)
    const name = graphNameFromFilename(file)
    entry = { id: record.id, file, name, updatedAt: record.updatedAt }
    manifest.entries[record.id] = entry
    fileToId.set(file, record.id)
    // Name may be suffixed (e.g. "Foo-2") when a collision exists on disk.
    // Propagate the de-duplicated name so callers persist the correct value to IDB.
    if (name !== record.name) saved = { ...record, name }
  } else {
    entry.name = record.name
    entry.updatedAt = record.updatedAt
    await alignEntryFileToName(ws, record, manifest, entry, fileToId)
  }
  const path = ws.path(entry.file)
  beginSuppressWatch()
  try {
    noteSelfWrite(path)
    await writeTextFile(path, recordToGraphFile(saved))
  } finally {
    endSuppressWatch()
  }
  await writeManifest(ws, manifest)
  return { manifest, record: saved }
}

export async function deleteGraphFromDisk(
  ws: WorkspaceTarget,
  graphId: string,
  manifest: WorkspaceManifest,
  fileToId: Map<string, string>,
): Promise<WorkspaceManifest> {
  const entry = manifest.entries[graphId]
  if (!entry) return manifest
  const { remove } = await fs()
  const path = ws.path(entry.file)
  beginSuppressWatch()
  try {
    noteSelfWrite(path)
    await remove(path).catch(() => {})
  } finally {
    endSuppressWatch()
  }
  fileToId.delete(entry.file)
  delete manifest.entries[graphId]
  await writeManifest(ws, manifest)
  return manifest
}

export async function loadRecordFromDiskFile(
  ws: WorkspaceTarget,
  filename: string,
  manifest: WorkspaceManifest,
  fileToId: Map<string, string>,
  claimedIds: Set<string> = new Set(),
): Promise<GraphRecord | null> {
  const { readTextFile, writeTextFile } = await fs()
  try {
    const text = await readTextFile(ws.path(filename))
    const file = deserializeGraph(text)
    const now = Date.now()
    const id = resolveGraphId(file, filename, fileToId, claimedIds)
    const reassignedId = id !== (file.id?.trim() ?? '')
    const { name, patched } = resolveGraphName(file, filename)
    const record: GraphRecord = {
      id,
      name,
      // The JSON format does not store createdAt; initialise it from updatedAt.
      createdAt: file.updatedAt ?? now,
      updatedAt: file.updatedAt ?? now,
      nodes: fillConceptNodeParams(file.nodes),
      edges: file.edges,
      display: file.display as GraphRecord['display'],
    }
    if (patched || reassignedId) {
      record.updatedAt = Date.now()
      beginSuppressWatch()
      try {
        noteSelfWrite(ws.path(filename))
        await writeTextFile(ws.path(filename), recordToGraphFile(record))
      } finally {
        endSuppressWatch()
      }
    }
    claimedIds.add(id)
    return record
  } catch {
    return null
  }
}

export async function listWorkspaceJsonFiles(ws: WorkspaceTarget): Promise<string[]> {
  const { readDir } = await fs()
  try {
    const entries = await readDir(ws.path(''))
    return entries.filter((e) => e.isFile && e.name?.endsWith('.json')).map((e) => e.name!)
  } catch {
    return []
  }
}

export async function graphFileExists(ws: WorkspaceTarget, filename: string): Promise<boolean> {
  const { exists } = await fs()
  try {
    return await exists(ws.path(filename))
  } catch {
    return false
  }
}

/** Resolve on-disk filename after external renames (manifest may still point at the old path). */
async function resolveGraphDiskFilename(
  ws: WorkspaceTarget,
  graphId: string,
  manifest: WorkspaceManifest,
  fileToId: Map<string, string>,
): Promise<string | null> {
  const entry = manifest.entries[graphId]
  if (entry && (await graphFileExists(ws, entry.file))) return entry.file

  const { readTextFile } = await fs()
  for (const filename of await listWorkspaceJsonFiles(ws)) {
    if (filename === MANIFEST_FILE) continue
    try {
      const text = await readTextFile(ws.path(filename))
      const file = deserializeGraph(text)
      if (resolveGraphId(file, filename, fileToId, new Set()) === graphId) return filename
    } catch {
      /* skip unreadable */
    }
  }
  return entry?.file ?? null
}

export async function reloadGraphFromDisk(
  ws: WorkspaceTarget,
  graphId: string,
  manifest: WorkspaceManifest,
): Promise<{ record: GraphRecord | null; manifest: WorkspaceManifest }> {
  const fileToId = buildFileToIdMap(manifest)
  const filename = await resolveGraphDiskFilename(ws, graphId, manifest, fileToId)
  if (!filename) return { record: null, manifest }

  const record = await loadRecordFromDiskFile(ws, filename, manifest, fileToId)
  if (!record) return { record: null, manifest }

  if (upsertManifestEntry(manifest, graphId, filename, record.name, record.updatedAt)) {
    await writeManifest(ws, manifest)
  }
  return { record, manifest }
}

async function cachedManifestForWorkspace(ws: WorkspaceTarget): Promise<WorkspaceManifest> {
  const { workspace: cw, manifest: cached } = getDiskSyncCache()
  return cw === ws.displayPath ? cached : readManifest(ws)
}

/**
 * Commit one graph record to the active project on disk — the source of truth.
 * Returns the persisted record (name may be de-duplicated); the caller mirrors
 * this exact record into IDB rather than the one it asked to save.
 */
export async function writeGraphRecordToWorkspace(
  settings: NessoSettings,
  record: GraphRecord,
): Promise<GraphRecord> {
  if (settings.activeProjectPath?.trim()) {
    await grantFsScope(settings.activeProjectPath.trim())
  }
  const ws = await resolveWorkspace(settings)
  const manifest = await cachedManifestForWorkspace(ws)
  const fileToId = buildFileToIdMap(manifest)
  const result = await saveGraphToDisk(ws, record, manifest, fileToId)
  setDiskSyncCache(ws.displayPath, result.manifest)
  return result.record
}

/** Remove a graph file and manifest entry from the active project. */
export async function removeGraphFromWorkspace(
  settings: NessoSettings,
  graphId: string,
): Promise<void> {
  if (settings.activeProjectPath?.trim()) {
    await grantFsScope(settings.activeProjectPath.trim())
  }
  const ws = await resolveWorkspace(settings)
  let manifest = await cachedManifestForWorkspace(ws)
  const fileToId = buildFileToIdMap(manifest)
  manifest = await deleteGraphFromDisk(ws, graphId, manifest, fileToId)
  setDiskSyncCache(ws.displayPath, manifest)
}
