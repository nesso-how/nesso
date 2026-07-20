// SPDX-License-Identifier: MIT
export {
  beginSuppressWatch,
  endSuppressWatch,
  isSelfWriteEcho,
  isWatchSuppressed,
} from '@/lib/workspace/watch'
export {
  resolveWorkspace,
  resolveWorkspacePath,
  getDefaultWorkspacePath,
  normalizePath,
  projectDisplayName,
} from '@/lib/workspace/paths'
export {
  getDiskSyncCache,
  setDiskSyncCache,
  isManifestOnlyWatchPaths,
  readManifest,
} from '@/lib/workspace/manifest'
export {
  uniqueGraphNameAmong,
  writeGraphRecordToWorkspace,
  removeGraphFromWorkspace,
  reloadGraphFromDisk,
} from '@/lib/workspace/graphFiles'
export { grantFsScope, pickWorkspaceFolder } from '@/lib/workspace/scope'
export {
  reconcileDiskWithIdb,
  persistWorkspaceSync,
  loadProjectFromDisk,
} from '@/lib/workspace/sync'
