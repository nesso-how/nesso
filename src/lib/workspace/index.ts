// SPDX-License-Identifier: MIT
export { beginSuppressWatch, endSuppressWatch, isWatchSuppressed } from '@/lib/workspace/watch'
export {
  GRAPHS_SUBDIR,
  resolveWorkspace,
  getDefaultWorkspacePath,
  resolveWorkspacePath,
  type WorkspaceTarget,
} from '@/lib/workspace/paths'
export {
  MANIFEST_DIR,
  MANIFEST_FILE,
  getDiskSyncCache,
  setDiskSyncCache,
  isManifestOnlyWatchPaths,
  readManifest,
  type GraphManifestEntry,
  type WorkspaceManifest,
} from '@/lib/workspace/manifest'
export {
  filenameBaseFromName,
  graphNameFromFilename,
  uniqueGraphNameAmong,
  recordToGraphFile,
  writeGraphRecordToWorkspace,
  removeGraphFromWorkspace,
  reloadGraphFromDisk,
} from '@/lib/workspace/graphFiles'
export { grantFsScope, pickWorkspaceFolder } from '@/lib/workspace/scope'
export {
  reconcileDiskWithIdb,
  persistWorkspaceSync,
  switchGraphWorkspaceFolder,
  type DiskReconcileResult,
} from '@/lib/workspace/sync'
