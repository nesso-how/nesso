// SPDX-License-Identifier: MIT
import type { GraphRecord } from '@/store/db'
import { dbDeleteGraph, dbListGraphs, dbSaveGraph } from '@/store/db'
import { graphPersistEquals } from '@/lib/graphPersist'
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
} from '@/lib/workspace/graphFiles'
import { resolveWorkspace, type WorkspaceTarget } from '@/lib/workspace/paths'
import { grantFsScope } from '@/lib/workspace/scope'

export interface DiskReconcileResult {
  manifest: WorkspaceManifest
  /** Records that should be written to IndexedDB (newer on disk or new files). */
  toPersist: GraphRecord[]
  /** Ids whose tracked file vanished from disk — should be dropped from IndexedDB. */
  removed: string[]
}

async function persistToIdb(records: GraphRecord[]): Promise<void> {
  for (const rec of records) await dbSaveGraph(rec)
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
    const loaded = await loadRecordFromDiskFile(ws, filename, manifest, fileToId, claimedIds)
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
      const saved = await saveGraphToDisk(ws, latest, manifest, fileToId)
      manifest = saved.manifest
      toPersist.push(saved.record)
    } else if (latest.updatedAt > entry.updatedAt) {
      ;({ manifest } = await saveGraphToDisk(ws, latest, manifest, fileToId))
    }
  }

  if (manifestDirty) {
    await writeManifest(ws, manifest)
  }

  return { manifest, toPersist, removed }
}

/** IndexedDB ↔ workspace sync; returns graph list after merge. */
export async function persistWorkspaceSync(
  settings: Pick<NessoSettings, 'activeProjectPath'>,
  records: GraphRecord[],
): Promise<GraphRecord[]> {
  const ws = await resolveWorkspace(settings)
  await grantFsScope(ws.displayPath)
  const { toPersist, manifest, removed } = await reconcileDiskWithIdb(ws, records)
  setDiskSyncCache(ws.displayPath, manifest)
  await persistToIdb(toPersist)
  for (const id of removed) await dbDeleteGraph(id)
  return dbListGraphs()
}

/** Load every graph from a project folder into IDB (disk is the source of truth). */
export async function loadProjectFromDisk(ws: WorkspaceTarget): Promise<GraphRecord[]> {
  const { toPersist, manifest } = await reconcileDiskWithIdb(ws, [])
  setDiskSyncCache(ws.displayPath, manifest)
  await persistToIdb(toPersist)
  return dbListGraphs()
}
