// SPDX-License-Identifier: MIT
import type { GraphRecord } from '@/store/db'
import type { NessoGraphDocument } from '@nesso-how/vocab-learning'
import type { NessoSettings } from '@/types/graph'
import { graphContentPayload } from '@/lib/graphPersist'
import { defaultGraphDisplay } from '@/types/graph'
import { deserializeEnvelope, serialize } from '@nesso-how/vocab-learning'
import { graphToDocument } from '@/lib/graphDocumentMapping'
import {
  normalizeParsedGraphDocument,
  tryResolveGraphIdentityFromEnvelope,
} from '@/lib/graphLoadNormalizer'
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

/** Thrown when a graph file is present on disk but cannot be loaded because its
 *  format, vocabulary, or version is unsupported by the current app. Distinct
 *  from filesystem errors (file missing, unreadable) which return null. */
export class UnsupportedGraphFileError extends Error {
  constructor(
    message: string,
    public readonly filename: string,
  ) {
    super(message)
    this.name = 'UnsupportedGraphFileError'
  }
}

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
  file: NessoGraphDocument,
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
  file: NessoGraphDocument,
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

function uniqueFilename(
  base: string,
  manifest: WorkspaceManifest,
  excludeId?: string,
  reservedPaths?: ReadonlySet<string>,
): string {
  let candidate = `${base}.json`
  let n = 2
  const used = new Set(
    Object.values(manifest.entries)
      .filter((e) => e.id !== excludeId)
      .map((e) => e.file),
  )
  // Also avoid reserved (unsupported) paths that exist on disk.
  if (reservedPaths) {
    for (const p of reservedPaths) used.add(p)
  }
  while (used.has(candidate)) {
    candidate = `${base}-${n}.json`
    n++
  }
  return candidate
}

export function recordToGraphFile(record: GraphRecord): string {
  const { nodes, edges, display } = graphContentPayload(
    record.nodes,
    record.edges,
    record.display ?? defaultGraphDisplay(),
  )
  return serialize(
    graphToDocument({
      id: record.id,
      updatedAt: record.updatedAt,
      name: record.name,
      nodes,
      edges,
      display,
    }),
  )
}

async function alignEntryFileToName(
  ws: WorkspaceTarget,
  record: GraphRecord,
  manifest: WorkspaceManifest,
  entry: GraphManifestEntry,
  fileToId: Map<string, string>,
  reservedPaths?: ReadonlySet<string>,
): Promise<void> {
  const expectedFile = uniqueFilename(
    filenameBaseFromName(record.name),
    manifest,
    record.id,
    reservedPaths,
  )
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
  reservedPaths?: ReadonlySet<string>,
): Promise<{ file: string; record: GraphRecord }> {
  const unique = uniqueGraphNameAmong(record.name, peerNames)
  if (unique === record.name) return { file: filename, record }
  const updated: GraphRecord = { ...record, name: unique, updatedAt: Date.now() }
  const file = await relocateGraphFile(ws, filename, updated, manifest, fileToId, reservedPaths)
  return { file, record: { ...updated, name: graphNameFromFilename(file) } }
}

async function relocateGraphFile(
  ws: WorkspaceTarget,
  currentFile: string,
  record: GraphRecord,
  manifest: WorkspaceManifest,
  fileToId: Map<string, string>,
  reservedPaths?: ReadonlySet<string>,
): Promise<string> {
  const targetFile = uniqueFilename(
    filenameBaseFromName(record.name),
    manifest,
    record.id,
    reservedPaths,
  )
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
  reservedPaths?: ReadonlySet<string>,
): Promise<{ manifest: WorkspaceManifest; record: GraphRecord }> {
  const { writeTextFile } = await fs()
  await ensureWorkspace(ws)
  let entry = manifest.entries[record.id]
  let saved = record
  if (!entry) {
    const file = uniqueFilename(
      filenameBaseFromName(record.name),
      manifest,
      record.id,
      reservedPaths,
    )
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
    // When the manifest entry points to a reserved (unsupported) file, rebind
    // to a fresh filename rather than renaming/moving the unsupported file.
    if (reservedPaths?.has(entry.file)) {
      const file = uniqueFilename(
        filenameBaseFromName(record.name),
        manifest,
        record.id,
        reservedPaths,
      )
      const name = graphNameFromFilename(file)
      fileToId.delete(entry.file)
      entry.file = file
      entry.name = name
      fileToId.set(file, record.id)
      // Propagate the de-duplicated filename-derived name so the returned
      // record and the on-disk JSON both carry it — no later self-healing rewrite.
      if (name !== saved.name) saved = { ...saved, name }
    } else {
      await alignEntryFileToName(ws, record, manifest, entry, fileToId, reservedPaths)
    }
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
  let text: string
  try {
    text = await readTextFile(ws.path(filename))
  } catch {
    // File vanished or is unreadable — treat as absent.
    return null
  }

  let file: NessoGraphDocument
  try {
    file = deserializeEnvelope(text)
  } catch (err) {
    throw new UnsupportedGraphFileError(
      `Cannot parse "${filename}": ${err instanceof Error ? err.message : String(err)}`,
      filename,
    )
  }

  try {
    const now = Date.now()
    const id = resolveGraphId(file, filename, fileToId, claimedIds)
    const reassignedId = id !== (file.id?.trim() ?? '')
    const { name, patched } = resolveGraphName(file, filename)

    const record = normalizeParsedGraphDocument(file, {
      id,
      name,
      createdAt: file.updatedAt ?? now,
      updatedAt: file.updatedAt ?? now,
    })

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
  } catch (err) {
    if (err instanceof UnsupportedGraphFileError) throw err
    throw new UnsupportedGraphFileError(
      `Cannot load "${filename}": ${err instanceof Error ? err.message : String(err)}`,
      filename,
    )
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

/** Try to match a single workspace JSON file to the requested graph id.
 *  Returns the filename if the file contains a graph whose id or manifest
 *  binding matches `graphId`, or `null` otherwise (including unreadable
 *  or unsupported files). */
async function tryMatchGraphFileById(
  ws: WorkspaceTarget,
  filename: string,
  graphId: string,
  fileToId: Map<string, string>,
): Promise<string | null> {
  if (filename === MANIFEST_FILE) return null
  try {
    const { readTextFile } = await fs()
    const text = await readTextFile(ws.path(filename))
    const identity = tryResolveGraphIdentityFromEnvelope(text)
    if (identity === null) return null // unsupported vocabulary — skip
    // Manifest binding takes priority over the embedded id.
    const fromManifest = fileToId.get(filename)
    if (fromManifest === graphId) return filename
    // Embedded id match (only for well-formed graph ids).
    if (identity.id && isGraphId(identity.id) && identity.id === graphId) return filename
  } catch {
    /* skip unreadable */
  }
  return null
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

  for (const filename of await listWorkspaceJsonFiles(ws)) {
    const match = await tryMatchGraphFileById(ws, filename, graphId, fileToId)
    if (match !== null) return match
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
  const ws = await resolveWorkspace(settings)
  await grantFsScope(ws.displayPath)
  const manifest = await cachedManifestForWorkspace(ws)
  const fileToId = buildFileToIdMap(manifest)
  const { workspace: cw, reservedPaths } = getDiskSyncCache()
  // Only use cached reservedPaths when they belong to the target workspace.
  // Stale reservations from a different workspace must not influence naming.
  const effectiveReserved =
    cw === ws.displayPath && reservedPaths.length > 0 ? new Set(reservedPaths) : undefined
  const result = await saveGraphToDisk(ws, record, manifest, fileToId, effectiveReserved)
  setDiskSyncCache(ws.displayPath, result.manifest)
  return result.record
}

/** Remove a graph file and manifest entry from the active project. */
export async function removeGraphFromWorkspace(
  settings: NessoSettings,
  graphId: string,
): Promise<void> {
  const ws = await resolveWorkspace(settings)
  await grantFsScope(ws.displayPath)
  let manifest = await cachedManifestForWorkspace(ws)
  const fileToId = buildFileToIdMap(manifest)
  manifest = await deleteGraphFromDisk(ws, graphId, manifest, fileToId)
  setDiskSyncCache(ws.displayPath, manifest)
}
