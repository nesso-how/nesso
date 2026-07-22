// SPDX-License-Identifier: MIT
import type { GraphRecord } from '@/store/db'
import { dbDeleteGraph, dbListGraphs, dbSaveGraph } from '@/store/db'
import { graphPersistEquals } from '@/lib/graphPersist'
import { normalizeGraphRecord } from '@/lib/graphLoadNormalizer'
import type { NessoSettings } from '@/types/graph'
import { defaultGraphDisplay } from '@/types/graph'
import {
  buildFileToIdMap,
  readManifest,
  setDiskSyncCache,
  upsertManifestEntry,
  writeManifest,
  ensureWorkspace,
  MANIFEST_FILE,
  type WorkspaceManifest,
} from '@/lib/workspace/manifest'
import {
  applyUniqueGraphNameOnDisk,
  graphFileExists,
  listWorkspaceJsonFiles,
  loadRecordFromDiskFile,
  saveGraphToDisk,
  UnsupportedGraphFileError,
} from '@/lib/workspace/graphFiles'
import { resolveWorkspace, type WorkspaceTarget } from '@/lib/workspace/paths'
import { grantFsScope } from '@/lib/workspace/scope'
import {
  tryResolveGraphIdentityFromEnvelope,
  normalizeParsedGraphDocument,
} from '@/lib/graphLoadNormalizer'
import { deserializeEnvelope } from '@nesso-how/vocab-learning'

export interface DiskReconcileResult {
  manifest: WorkspaceManifest
  /** Records that should be written to IndexedDB (newer on disk or new files). */
  toPersist: GraphRecord[]
  /** Ids whose tracked file vanished from disk — should be dropped from IndexedDB. */
  removed: string[]
  /** Filenames that exist on disk but could not be loaded (unsupported format, foreign vocabulary, etc). */
  unsupportedFiles: string[]
  /**
   * Filenames that exist on disk as unsupported files and must never be
   * overwritten by subsequent save/sync operations. Callers should pass
   * these to `saveGraphToDisk` so that `uniqueFilename` avoids them.
   */
  reservedPaths: string[]
}

async function persistToIdb(records: GraphRecord[]): Promise<void> {
  for (const rec of records) await dbSaveGraph(rec)
}

async function loadOrSkipUnsupported(
  ws: WorkspaceTarget,
  filename: string,
  manifest: WorkspaceManifest,
  fileToId: Map<string, string>,
  claimedIds: Set<string>,
  unsupportedFiles: string[],
  reservedPaths: Set<string>,
): Promise<GraphRecord | null> {
  try {
    return await loadRecordFromDiskFile(ws, filename, manifest, fileToId, claimedIds)
  } catch (err) {
    if (err instanceof UnsupportedGraphFileError) {
      unsupportedFiles.push(err.filename)
      reservedPaths.add(err.filename)
      return null
    }
    throw err
  }
}

/**
 * Two-phase merge between the workspace folder and IndexedDB.
 *
 * Phase 1 (disk → IDB): reads every JSON file on disk, de-duplicates names,
 * and collects records that are newer on disk or absent from IDB into `toPersist`.
 * `idbById` is updated in-place so Phase 2 sees the post-disk view.
 *
 * Phase 2 (IDB → disk): ensures every IDB record that has no corresponding file
 * is written to disk, and flushes any IDB record whose `updatedAt` exceeds the
 * manifest entry (i.e. was saved from another device or before the workspace existed).
 */
export async function reconcileDiskWithIdb(
  ws: WorkspaceTarget,
  idbRecords: GraphRecord[],
): Promise<DiskReconcileResult> {
  await ensureWorkspace(ws)
  let manifest = await readManifest(ws)
  const fileToId = buildFileToIdMap(manifest)
  const idbById = new Map(idbRecords.map((r) => [r.id, r]))
  const toPersist: GraphRecord[] = []
  let manifestDirty = false
  const unsupportedFiles: string[] = []
  // Files that exist on disk but cannot be loaded — their paths must be
  // reserved so that subsequent save operations (Phase 2 below, or a later
  // seed) do not overwrite them with supported content.
  const reservedPaths = new Set<string>()
  // Ids already bound to a file (via the manifest, or claimed earlier in this
  // scan) — lets a duplicated/copied file that embeds the same id as another
  // on-disk file become its own graph instead of colliding with it regardless
  // of directory listing order (see loadRecordFromDiskFile).
  const claimedIds = new Set<string>(fileToId.values())
  // Ids matched to a readable file this scan — anything tracked but absent
  // here (and missing on disk) was deleted externally; see the removal pass below.
  const seenIds = new Set<string>()

  const diskGraphFiles = (await listWorkspaceJsonFiles(ws)).filter((f) => f !== MANIFEST_FILE)

  for (const filename of diskGraphFiles) {
    const loaded = await loadOrSkipUnsupported(
      ws,
      filename,
      manifest,
      fileToId,
      claimedIds,
      unsupportedFiles,
      reservedPaths,
    )
    if (!loaded) continue

    const id = loaded.id
    seenIds.add(id)
    const peerNames = [...idbById.values()].filter((r) => r.id !== id).map((r) => r.name)
    const { file: entryFile, record: diskRecord } = await applyUniqueGraphNameOnDisk(
      ws,
      filename,
      loaded,
      peerNames,
      manifest,
      fileToId,
      reservedPaths,
    )

    const idb = idbById.get(id)
    if (
      !idb ||
      idb.name !== diskRecord.name ||
      // Content differs: the file was edited externally either with a bumped
      // timestamp or without (e.g. hand-edited in a text editor). The folder
      // is the source of truth — pick the change up here, or the next in-app
      // save would silently overwrite it. A newer timestamp with identical
      // content (self-healing name/id rewrite, or the app's own save before
      // savedFingerprint updates) is NOT enough — it would cause false
      // conflict detections in handleWatchEvent.
      !graphPersistEquals(
        {
          nodes: diskRecord.nodes,
          edges: diskRecord.edges,
          display: diskRecord.display ?? defaultGraphDisplay(),
        },
        { nodes: idb.nodes, edges: idb.edges, display: idb.display ?? defaultGraphDisplay() },
      )
    ) {
      toPersist.push(diskRecord)
    }
    idbById.set(id, diskRecord)
    if (upsertManifestEntry(manifest, id, entryFile, diskRecord.name, diskRecord.updatedAt)) {
      manifestDirty = true
    }
    fileToId.set(entryFile, id)
  }

  // A tracked graph whose file is gone (and no other on-disk file claimed its
  // id) was deleted outside the app — drop it instead of silently re-creating it.
  const removed: string[] = []
  for (const record of idbRecords) {
    if (seenIds.has(record.id)) continue
    const entry = manifest.entries[record.id]
    if (!entry || (await graphFileExists(ws, entry.file))) continue
    delete manifest.entries[record.id]
    idbById.delete(record.id)
    removed.push(record.id)
    manifestDirty = true
  }
  const removedIds = new Set(removed)

  for (const record of idbRecords) {
    if (removedIds.has(record.id)) continue
    const latest = idbById.get(record.id) ?? record
    const entry = manifest.entries[record.id]
    if (!entry) {
      const saved = await saveGraphToDisk(ws, latest, manifest, fileToId, reservedPaths)
      manifest = saved.manifest
      toPersist.push(saved.record)
    } else if (latest.updatedAt > entry.updatedAt) {
      ;({ manifest } = await saveGraphToDisk(ws, latest, manifest, fileToId, reservedPaths))
    }
  }

  if (manifestDirty) {
    await writeManifest(ws, manifest)
  }

  return {
    manifest,
    toPersist,
    removed,
    unsupportedFiles,
    reservedPaths: [...reservedPaths],
  }
}

/** IndexedDB ↔ workspace sync; returns graph list after merge. */
export async function persistWorkspaceSync(
  settings: Pick<NessoSettings, 'activeProjectPath'>,
  records: GraphRecord[],
): Promise<GraphRecord[]> {
  const ws = await resolveWorkspace(settings)
  await grantFsScope(ws.displayPath)
  const { toPersist, manifest, removed, reservedPaths } = await reconcileDiskWithIdb(ws, records)
  setDiskSyncCache(ws.displayPath, manifest, reservedPaths)
  await persistToIdb(toPersist)
  for (const id of removed) await dbDeleteGraph(id)
  const raw = await dbListGraphs()
  const out: GraphRecord[] = []
  for (const r of raw) {
    try {
      out.push(normalizeGraphRecord(r))
    } catch {
      // Isolate: a single corrupt IDB row must not abort the entire
      // sync. The corrupt data is preserved in IDB — never deleted.
      console.warn(
        '[nesso] persistWorkspaceSync skipping corrupt graph record:',
        typeof (r as { id?: unknown })?.id === 'string' ? (r as { id: string }).id : '?',
      )
    }
  }
  return out
}

export interface ProjectLoadResult {
  records: GraphRecord[]
  /** Filenames that exist on disk but could not be loaded. */
  unsupportedFiles: string[]
}

/**
 * Quick compatibility scan: reads every JSON file in the workspace and
 * classifies each as supported or unsupported without full normalization.
 * Returns `"unsupported-only"` when every file is unsupported, `"empty"`
 * when there are no graph files, and `"compatible"` otherwise.
 *
 * Callers use this before clearing IDB or committing a path switch, so
 * they can block early without data loss.
 */
export async function checkWorkspaceCompatibility(
  ws: WorkspaceTarget,
): Promise<{ status: 'empty' | 'unsupported-only' | 'compatible'; unsupportedCount: number }> {
  const { readTextFile } = await import('@tauri-apps/plugin-fs')
  const files = (await listWorkspaceJsonFiles(ws)).filter((f) => f !== MANIFEST_FILE)

  if (files.length === 0) return { status: 'empty', unsupportedCount: 0 }

  let supportedCount = 0
  let unsupportedCount = 0

  for (const filename of files) {
    try {
      const text = await readTextFile(ws.path(filename))
      const identity = tryResolveGraphIdentityFromEnvelope(text)
      if (identity === null) {
        unsupportedCount++
        continue
      }
      // The envelope passes, but the content may still be malformed (invalid
      // relation types, removed alpha elaboration fields, etc.). Attempt a
      // full normalization to catch these before the preflight reports
      // "compatible" — otherwise the caller may clear IDB / commit a path
      // before discovering the files are actually unloadable.
      const document = deserializeEnvelope(text)
      normalizeParsedGraphDocument(document, {
        id: identity.id,
        name: identity.name,
        createdAt: 0,
        updatedAt: 0,
      })
      supportedCount++
    } catch {
      unsupportedCount++
    }
  }

  if (supportedCount === 0 && unsupportedCount > 0) {
    return { status: 'unsupported-only', unsupportedCount }
  }
  return { status: 'compatible', unsupportedCount }
}

/** Load every graph from a project folder into IDB (disk is the source of truth). */
export async function loadProjectFromDisk(ws: WorkspaceTarget): Promise<ProjectLoadResult> {
  const { toPersist, manifest, unsupportedFiles } = await reconcileDiskWithIdb(ws, [])
  setDiskSyncCache(ws.displayPath, manifest, unsupportedFiles)
  await persistToIdb(toPersist)
  const raw = await dbListGraphs()
  const records: GraphRecord[] = []
  for (const r of raw) {
    try {
      records.push(normalizeGraphRecord(r))
    } catch {
      console.warn(
        '[nesso] loadProjectFromDisk skipping corrupt graph record:',
        typeof (r as { id?: unknown })?.id === 'string' ? (r as { id: string }).id : '?',
      )
    }
  }
  return { records, unsupportedFiles }
}
