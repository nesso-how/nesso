// SPDX-License-Identifier: MIT
import { joinPath, normalizePath } from '@/lib/workspace/paths'
import { MANIFEST_DIR } from '@/lib/workspace/manifest'

export async function grantFsScope(path: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  const norm = normalizePath(path)
  await invoke('grant_fs_scope', { path: norm })
  const manifestDir = joinPath(norm, MANIFEST_DIR)
  if (manifestDir !== norm) {
    await invoke('grant_fs_scope', { path: manifestDir })
  }
}

/**
 * Opens the native folder-picker dialog **on the Rust side** and grants
 * filesystem scope for the selected folder.  The renderer never provides
 * the path — the Rust side owns the dialog, so the returned path is
 * human-verified.
 *
 * Returns the selected absolute path, or `null` when the user cancels.
 */
export async function pickWorkspaceFolder(): Promise<string | null> {
  const { invoke } = await import('@tauri-apps/api/core')
  return (await invoke('pick_workspace_folder')) as string | null
}
