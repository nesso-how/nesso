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

export async function pickWorkspaceFolder(): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({ directory: true, multiple: false })
  if (selected === null || Array.isArray(selected)) return null
  await grantFsScope(selected)
  return selected
}
