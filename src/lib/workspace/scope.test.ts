// SPDX-License-Identifier: MIT
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { tauriFsState, getGrantedPaths, seedTrustedPath } from '@/test/fakeTauriFs'

vi.mock('@tauri-apps/api/core', async () => (await import('@/test/fakeTauriFs')).fakeCoreApi)

import { grantFsScope, pickWorkspaceFolder } from './scope'

beforeEach(() => {
  tauriFsState.reset()
})

describe('grantFsScope', () => {
  it('calls the backend with the normalized project path', async () => {
    seedTrustedPath('/home/user/projects/my-graph')
    await grantFsScope('/home/user/projects/my-graph')

    const granted = getGrantedPaths()
    expect(granted.has('/home/user/projects/my-graph')).toBe(true)
  })

  it('strips trailing slashes before invoking', async () => {
    seedTrustedPath('/home/user/projects/my-graph')
    await grantFsScope('/home/user/projects/my-graph/')

    const granted = getGrantedPaths()
    expect(granted.has('/home/user/projects/my-graph')).toBe(true)
  })

  it('also grants scope for the .nesso manifest directory under the project', async () => {
    seedTrustedPath('/home/user/projects/my-graph')
    await grantFsScope('/home/user/projects/my-graph')

    const granted = getGrantedPaths()
    expect(granted.has('/home/user/projects/my-graph/.nesso')).toBe(true)
  })

  it('does not double-invoke when the path itself ends with .nesso', async () => {
    seedTrustedPath('/home/user/projects/.nesso')
    await grantFsScope('/home/user/projects/.nesso')

    const granted = getGrantedPaths()
    // joinPath('/home/user/projects/.nesso', '.nesso') == '/home/user/projects/.nesso/.nesso'
    // which differs from the input, so both are granted.
    expect(granted.has('/home/user/projects/.nesso')).toBe(true)
    expect(granted.has('/home/user/projects/.nesso/.nesso')).toBe(true)
    expect(granted.size).toBe(2)
  })

  it('grants app-data .nesso paths without picker trust (auto-grant)', async () => {
    // App-data .nesso subtrees are always trusted — no seed needed.
    await grantFsScope('/appdata/graphs/.nesso')

    const granted = getGrantedPaths()
    expect(granted.has('/appdata/graphs/.nesso')).toBe(true)
  })

  it('rejects an external path not in the trust store', async () => {
    await grantFsScope('/home/user/not-trusted')

    const granted = getGrantedPaths()
    expect(granted.has('/home/user/not-trusted')).toBe(false)
  })
})

describe('pickWorkspaceFolder', () => {
  it('returns the picked path when the dialog result is set', async () => {
    tauriFsState.setDialogResult('/home/user/projects/picked')

    const result = await pickWorkspaceFolder()

    expect(result).toBe('/home/user/projects/picked')
  })

  it('returns null when the dialog was cancelled', async () => {
    tauriFsState.setDialogResult(null)

    const result = await pickWorkspaceFolder()

    expect(result).toBeNull()
  })

  it('adds the picked path to the trust store so descendents are grantable', async () => {
    tauriFsState.setDialogResult('/home/user/projects/picked-fresh')

    await pickWorkspaceFolder()

    // Now a descendant path should be grantable without explicit seeding.
    await grantFsScope('/home/user/projects/picked-fresh/.nesso')

    const granted = getGrantedPaths()
    expect(granted.has('/home/user/projects/picked-fresh/.nesso')).toBe(true)
  })
})
