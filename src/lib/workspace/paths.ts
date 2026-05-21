// SPDX-License-Identifier: MIT
import type { NessoSettings } from '@/types/graph'

export const GRAPHS_SUBDIR = 'graphs'

export interface WorkspaceTarget {
  /** Absolute path for watch() and Settings display */
  displayPath: string
  path: (rel: string) => string
}

export function joinPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/')
}

export function normalizePath(p: string): string {
  return p.replace(/\/+$/, '')
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

export async function resolveWorkspace(settings: Pick<NessoSettings, 'graphWorkspacePath'>): Promise<WorkspaceTarget> {
  const { appDataDir } = await pathApi()
  const appDataRoot = normalizePath(await appDataDir())
  const defaultDisplay = joinPath(appDataRoot, GRAPHS_SUBDIR)

  const custom = settings.graphWorkspacePath?.trim()
  if (custom) {
    const norm = normalizePath(custom)
    if (norm === normalizePath(defaultDisplay) || norm === appDataRoot) {
      return defaultBundledWorkspace(appDataRoot)
    }
    return {
      displayPath: custom,
      path: (rel) => (rel ? joinPath(custom, rel) : custom),
    }
  }
  return defaultBundledWorkspace(appDataRoot)
}

export async function getDefaultWorkspacePath(): Promise<string> {
  const { appDataDir } = await pathApi()
  return joinPath(await appDataDir(), GRAPHS_SUBDIR)
}

export async function resolveWorkspacePath(settings: Pick<NessoSettings, 'graphWorkspacePath'>): Promise<string> {
  const ws = await resolveWorkspace(settings)
  return ws.displayPath
}
