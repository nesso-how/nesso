// SPDX-License-Identifier: MIT
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { tauriFsState } from '@/test/fakeTauriFs'

vi.mock('@tauri-apps/api/core', async () => (await import('@/test/fakeTauriFs')).fakeCoreApi)

import { grantFsScope, pickWorkspaceFolder } from './scope'

beforeEach(() => {
  tauriFsState.reset()
})

describe('grantFsScope', () => {
  const lastGrants = () =>
    tauriFsState.calls
      .filter((c) => c.command === 'grant_fs_scope')
      .map((c) => c.args?.path as string)

  it.each([
    [
      'normal path',
      '/home/user/projects/my-graph',
      ['/home/user/projects/my-graph', '/home/user/projects/my-graph/.nesso'],
    ],
    [
      'trailing slash',
      '/home/user/projects/my-graph/',
      ['/home/user/projects/my-graph', '/home/user/projects/my-graph/.nesso'],
    ],
    [
      '.nesso-ending path',
      '/home/user/projects/.nesso',
      ['/home/user/projects/.nesso', '/home/user/projects/.nesso/.nesso'],
    ],
    [
      'app-data .nesso',
      '/appdata/graphs/.nesso',
      ['/appdata/graphs/.nesso', '/appdata/graphs/.nesso/.nesso'],
    ],
  ])('records IPC calls for %s', async (_, input, expectedPaths) => {
    await grantFsScope(input)
    expect(lastGrants()).toEqual(expectedPaths)
  })
})

describe('pickWorkspaceFolder', () => {
  it('returns the picked path when a folder was selected', async () => {
    tauriFsState.setDialogResult('/home/user/projects/picked')
    const result = await pickWorkspaceFolder()
    expect(result).toBe('/home/user/projects/picked')
    expect(tauriFsState.calls[0].command).toBe('pick_workspace_folder')
  })

  it('returns null when the dialog was cancelled', async () => {
    tauriFsState.setDialogResult(null)
    const result = await pickWorkspaceFolder()
    expect(result).toBeNull()
    expect(tauriFsState.calls[0].command).toBe('pick_workspace_folder')
  })
})
