// SPDX-License-Identifier: MIT
import type { NessoSettings } from '@/types/graph'

export const GRAPHS_SUBDIR = 'graphs'

export interface WorkspaceTarget {
  /** Absolute path for watch() and Settings display */
  displayPath: string
  path: (rel: string) => string
}

export function joinPath(...parts: string[]): string {
  const joined = parts.filter(Boolean).join('/')
  // Preserve a leading double slash (Windows UNC paths like //server/share).
  const uncPrefix = joined.startsWith('//') ? '/' : ''
  return uncPrefix + joined.replace(/\/+/g, '/')
}

export function normalizePath(p: string): string {
  return p.replace(/\/+$/, '')
}

/** Display name for a project: the folder's basename (handles both `/` and `\` separators). */
export function projectNameFromPath(path: string): string {
  const norm = normalizePath(path).replace(/\\/g, '/')
  return norm.split('/').pop()?.trim() || norm
}

/**
 * Display name for a project, swapping the bundled default's folder basename
 * (`graphs`, not user-facing) for a friendly localized label.
 */
export function projectDisplayName(
  path: string,
  defaultPath: string | null,
  defaultLabel: string,
): string {
  if (defaultPath && normalizePath(path) === normalizePath(defaultPath)) return defaultLabel
  return projectNameFromPath(path)
}

function defaultBundledWorkspace(appDataRoot: string): WorkspaceTarget {
  const displayPath = joinPath(appDataRoot, GRAPHS_SUBDIR)
  return {
    displayPath,
    path: (rel) => (rel ? joinPath(displayPath, rel) : displayPath),
  }
}

async function pathApi() {
  return import('@tauri-apps/api/path')
}

export async function resolveWorkspace(
  settings: Pick<NessoSettings, 'activeProjectPath'>,
): Promise<WorkspaceTarget> {
  const { appDataDir } = await pathApi()
  const appDataRoot = normalizePath(await appDataDir())
  const defaultDisplay = joinPath(appDataRoot, GRAPHS_SUBDIR)

  const active = settings.activeProjectPath?.trim()
  if (active) {
    const norm = normalizePath(active)
    if (norm === normalizePath(defaultDisplay) || norm === appDataRoot) {
      return defaultBundledWorkspace(appDataRoot)
    }
    return {
      displayPath: active,
      path: (rel) => (rel ? joinPath(active, rel) : active),
    }
  }
  return defaultBundledWorkspace(appDataRoot)
}

export async function getDefaultWorkspacePath(): Promise<string> {
  const { appDataDir } = await pathApi()
  return joinPath(await appDataDir(), GRAPHS_SUBDIR)
}
