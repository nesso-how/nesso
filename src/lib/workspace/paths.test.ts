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
  it.each([
    ['app-data root → /graphs subdir', '/appdata', '/appdata/graphs'],
    ['default workspace path unchanged', '/appdata/graphs', '/appdata/graphs'],
    ['external path preserved', '/home/user/projects/my-graph', '/home/user/projects/my-graph'],
  ])('%s', async (_, activeProjectPath, expectedDisplay) => {
    const ws = await resolveWorkspace({ activeProjectPath })
    expect(ws.displayPath).toBe(expectedDisplay)
    expect(ws.path('')).toBe(expectedDisplay)
  })

  it('returns default workspace when no activeProjectPath is set', async () => {
    const ws = await resolveWorkspace({ activeProjectPath: null })
    expect(ws.displayPath).toBe('/appdata/graphs')
  })
})

describe('resolveWorkspacePath', () => {
  it.each([
    ['app-data root → /graphs subdir', '/appdata', '/appdata/graphs'],
    ['app-data root with trailing slash', '/appdata/', '/appdata/graphs'],
    ['default workspace unchanged', '/appdata/graphs', '/appdata/graphs'],
    ['external path preserved', '/home/user/projects/my-graph', '/home/user/projects/my-graph'],
  ])('%s', async (_, input, expected) => {
    const result = await resolveWorkspacePath(input)
    expect(result).toBe(expected)
  })
})

describe('joinPath', () => {
  it.each([
    ['a', 'b', 'c', 'a/b/c'],
    ['a', '', 'c', 'a/c'],
    ['/root', 'graphs', undefined, '/root/graphs'],
    ['a//b', 'c', undefined, 'a/b/c'],
  ])('%s', (...args) => {
    const expected = args.pop() as string
    expect(joinPath(...(args as string[]))).toBe(expected)
  })

  it('preserves a leading double slash for UNC paths', () => {
    expect(joinPath('//server', 'share')).toBe('//server/share')
  })
})

describe('normalizePath', () => {
  it.each([
    ['/a/b/', '/a/b'],
    ['/a/b///', '/a/b'],
    ['/a/b', '/a/b'],
  ])('strips trailing slashes: %s → %s', (input, expected) => {
    expect(normalizePath(input)).toBe(expected)
  })
})

describe('projectNameFromPath', () => {
  it.each([
    ['/home/user/My Project', 'My Project'],
    ['C:\\Users\\me\\proj', 'proj'],
    ['/home/user/proj/', 'proj'],
  ])('%s → %s', (input, expected) => {
    expect(projectNameFromPath(input)).toBe(expected)
  })
})

describe('projectDisplayName', () => {
  it.each([
    ['/app/data/graphs', '/app/data/graphs', 'My Graphs', 'My Graphs'],
    ['/app/data/graphs/', '/app/data/graphs', 'My Graphs', 'My Graphs'],
    ['/home/user/other', '/app/data/graphs', 'My Graphs', 'other'],
    ['/home/user/other', null, 'My Graphs', 'other'],
  ])('%s (default %s) → %s', (path, defaultPath, label, expected) => {
    expect(projectDisplayName(path, defaultPath, label)).toBe(expected)
  })
})
