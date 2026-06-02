// SPDX-License-Identifier: MIT
import type { GraphRecord } from '@/store/db'
import { dbListGraphs, dbSaveGraph } from '@/store/db'
import type { NessoSettings } from '@/types/graph'
import {
  buildFileToIdMap,
  readManifest,
  setDiskSyncCache,
  upsertManifestEntry,
  writeManifest,
  ensureWorkspace,
  MANIFEST_DIR,
  MANIFEST_FILE,
  type WorkspaceManifest,
} from '@/lib/workspace/manifest'
import {
  applyUniqueGraphNameOnDisk,
  listWorkspaceJsonFiles,
  loadRecordFromDiskFile,
  saveGraphToDisk,
} from '@/lib/workspace/graphFiles'
import { normalizePath, resolveWorkspace, type WorkspaceTarget } from '@/lib/workspace/paths'
import { beginSuppressWatch, endSuppressWatch } from '@/lib/workspace/watch'
import { grantFsScope } from '@/lib/workspace/scope'

export interface DiskReconcileResult {
  manifest: WorkspaceManifest
  /** Records that should be written to IndexedDB (newer on disk or new files). */
  toPersist: GraphRecord[]
}

async function persistToIdb(records: GraphRecord[]): Promise<void> {
  for (const rec of records) await dbSaveGraph(rec)
}

async function fs() {
  return import('@tauri-apps/plugin-fs')
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

  const diskGraphFiles = (await listWorkspaceJsonFiles(ws)).filter((f) => f !== MANIFEST_FILE)

  for (const filename of diskGraphFiles) {
    const loaded = await loadRecordFromDiskFile(ws, filename, manifest, fileToId)
    if (!loaded) continue

    const id = loaded.id
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
    if (!idb || diskRecord.updatedAt > idb.updatedAt || idb.name !== diskRecord.name) {
      toPersist.push(diskRecord)
    }
    idbById.set(id, diskRecord)
    if (upsertManifestEntry(manifest, id, entryFile, diskRecord.name, diskRecord.updatedAt)) {
      manifestDirty = true
    }
    fileToId.set(entryFile, id)
  }

  for (const record of idbRecords) {
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

  return { manifest, toPersist }
}

/** IndexedDB ↔ workspace sync; returns graph list after merge. */
export async function persistWorkspaceSync(
  settings: Pick<NessoSettings, 'graphWorkspacePath'>,
  records: GraphRecord[],
): Promise<GraphRecord[]> {
  if (settings.graphWorkspacePath?.trim()) {
    await grantFsScope(settings.graphWorkspacePath.trim())
  }
  const ws = await resolveWorkspace(settings)
  const { toPersist, manifest } = await reconcileDiskWithIdb(ws, records)
  setDiskSyncCache(ws.displayPath, manifest)
  await persistToIdb(toPersist)
  return dbListGraphs()
}

/** Remove all graph JSON and workspace metadata when leaving a workspace folder. */
export async function clearWorkspace(ws: WorkspaceTarget): Promise<void> {
  const { remove, exists } = await fs()
  for (const filename of await listWorkspaceJsonFiles(ws)) {
    beginSuppressWatch()
    try {
      await remove(ws.path(filename)).catch(() => {})
    } finally {
      endSuppressWatch()
    }
  }
  const rel = `${MANIFEST_DIR}/${MANIFEST_FILE}`
  beginSuppressWatch()
  try {
    await remove(ws.path(rel)).catch(() => {})
    const dirPath = ws.path(MANIFEST_DIR)
    if (await exists(dirPath)) await remove(dirPath).catch(() => {})
  } finally {
    endSuppressWatch()
  }
}

/** Change workspace folder: merge old disk → IDB, sync to new folder, clear old folder. */
export async function switchGraphWorkspaceFolder(
  previousSettings: Pick<NessoSettings, 'graphWorkspacePath'>,
  nextSettings: Pick<NessoSettings, 'graphWorkspacePath'>,
): Promise<GraphRecord[]> {
  const oldWs = await resolveWorkspace(previousSettings)
  const nextWs = await resolveWorkspace(nextSettings)
  if (normalizePath(oldWs.displayPath) === normalizePath(nextWs.displayPath)) {
    return dbListGraphs()
  }

  let records = await dbListGraphs()
  const prevCustom = previousSettings.graphWorkspacePath?.trim()
  if (prevCustom) await grantFsScope(prevCustom)

  const { toPersist: fromOld } = await reconcileDiskWithIdb(oldWs, records)
  await persistToIdb(fromOld)
  records = await dbListGraphs()

  const nextCustom = nextSettings.graphWorkspacePath?.trim()
  if (nextCustom) await grantFsScope(nextCustom)

  records = await persistWorkspaceSync(nextSettings, records)

  await clearWorkspace(oldWs)
  return records
}
