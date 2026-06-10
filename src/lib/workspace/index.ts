// SPDX-License-Identifier: MIT
export {
  beginSuppressWatch,
  endSuppressWatch,
  isSelfWriteEcho,
  isWatchSuppressed,
  noteSelfWrite,
} from '@/lib/workspace/watch'
export {
  GRAPHS_SUBDIR,
  resolveWorkspace,
  getDefaultWorkspacePath,
  resolveWorkspacePath,
  normalizePath,
  projectNameFromPath,
  projectDisplayName,
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
export { grantFsScope, pickWorkspaceFolder, createProjectFolder } from '@/lib/workspace/scope'
export {
  reconcileDiskWithIdb,
  persistWorkspaceSync,
  loadProjectFromDisk,
  type DiskReconcileResult,
} from '@/lib/workspace/sync'
