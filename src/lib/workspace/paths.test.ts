// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest'
import {
  joinPath,
  normalizePath,
  projectDisplayName,
  projectNameFromPath,
  resolveWorkspace,
  resolveWorkspacePath,
} from './paths'

vi.mock('@tauri-apps/api/path', async () => (await import('@/test/fakeTauriFs')).fakePathApi)

describe('resolveWorkspace', () => {
  it('maps app-data root to the default workspace "graphs" subdir', async () => {
    const ws = await resolveWorkspace({ activeProjectPath: '/appdata' })
    expect(ws.displayPath).toBe('/appdata/graphs')
    expect(ws.path('')).toBe('/appdata/graphs')
  })

  it('maps default workspace path to itself', async () => {
    const ws = await resolveWorkspace({ activeProjectPath: '/appdata/graphs' })
    expect(ws.displayPath).toBe('/appdata/graphs')
    expect(ws.path('')).toBe('/appdata/graphs')
  })

  it('preserves external workspace paths', async () => {
    const ws = await resolveWorkspace({ activeProjectPath: '/home/user/projects/my-graph' })
    expect(ws.displayPath).toBe('/home/user/projects/my-graph')
    expect(ws.path('')).toBe('/home/user/projects/my-graph')
  })

  it('returns default workspace when no activeProjectPath is set', async () => {
    const ws = await resolveWorkspace({ activeProjectPath: null })
    expect(ws.displayPath).toBe('/appdata/graphs')
  })
})

describe('joinPath', () => {
  it('joins parts with a single slash and drops empty segments', () => {
    expect(joinPath('a', 'b', 'c')).toBe('a/b/c')
    expect(joinPath('a', '', 'c')).toBe('a/c')
    expect(joinPath('/root', 'graphs')).toBe('/root/graphs')
  })

  it('collapses redundant slashes', () => {
    expect(joinPath('a//b', 'c')).toBe('a/b/c')
  })

  it('preserves a leading double slash for Windows UNC paths', () => {
    expect(joinPath('//server', 'share')).toBe('//server/share')
  })
})

describe('normalizePath', () => {
  it('strips trailing slashes', () => {
    expect(normalizePath('/a/b/')).toBe('/a/b')
    expect(normalizePath('/a/b///')).toBe('/a/b')
    expect(normalizePath('/a/b')).toBe('/a/b')
  })
})

describe('projectNameFromPath', () => {
  it('returns the folder basename for posix paths', () => {
    expect(projectNameFromPath('/home/user/My Project')).toBe('My Project')
  })

  it('handles backslash separators', () => {
    expect(projectNameFromPath('C:\\Users\\me\\proj')).toBe('proj')
  })

  it('ignores a trailing slash', () => {
    expect(projectNameFromPath('/home/user/proj/')).toBe('proj')
  })
})

describe('projectDisplayName', () => {
  it('swaps the bundled default path for a friendly label', () => {
    expect(projectDisplayName('/app/data/graphs', '/app/data/graphs', 'My Graphs')).toBe(
      'My Graphs',
    )
    // Trailing-slash difference still resolves to the default.
    expect(projectDisplayName('/app/data/graphs/', '/app/data/graphs', 'My Graphs')).toBe(
      'My Graphs',
    )
  })

  it('falls back to the folder basename for any other path', () => {
    expect(projectDisplayName('/home/user/other', '/app/data/graphs', 'My Graphs')).toBe('other')
    expect(projectDisplayName('/home/user/other', null, 'My Graphs')).toBe('other')
  })
})

describe('resolveWorkspacePath', () => {
  it('maps app-data root to default workspace "graphs" subdir', async () => {
    const result = await resolveWorkspacePath('/appdata')
    expect(result).toBe('/appdata/graphs')
  })

  it('preserves the default workspace path as-is', async () => {
    const result = await resolveWorkspacePath('/appdata/graphs')
    expect(result).toBe('/appdata/graphs')
  })

  it('preserves external workspace paths unchanged', async () => {
    const result = await resolveWorkspacePath('/home/user/projects/my-graph')
    expect(result).toBe('/home/user/projects/my-graph')
  })

  it('strips trailing slashes before comparison', async () => {
    const result = await resolveWorkspacePath('/appdata/')
    expect(result).toBe('/appdata/graphs')
  })
})
