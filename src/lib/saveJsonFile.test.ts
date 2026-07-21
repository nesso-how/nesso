// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import { describe, expect, it, beforeEach, vi } from 'vitest'

vi.mock('@tauri-apps/api/core', async () => (await import('@/test/fakeTauriFs')).fakeCoreApi)

import { tauriFsState } from '@/test/fakeTauriFs'
import { exportShareGraphJson } from '@/lib/saveJsonFile'

beforeEach(() => {
  tauriFsState.reset()
})

describe('exportShareGraphJson', () => {
  describe('desktop (Tauri internals present)', () => {
    beforeEach(() => {
      ;(window as unknown as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {}
    })

    it('writes via the native save_file_dialog command', async () => {
      tauriFsState.setDialogResult('/Users/me/Desktop/export.json')
      await exportShareGraphJson('MyGraph.json', '{"version":1}')
      expect(tauriFsState.files.get('/Users/me/Desktop/export.json')).toBe('{"version":1}')
    })

    it('returns early without writing when the user cancels the dialog', async () => {
      tauriFsState.setDialogResult(null)
      await exportShareGraphJson('MyGraph.json', '{"version":1}')
      expect(tauriFsState.files.size).toBe(0)
    })

    it('does not require the path to be under a .nesso directory', async () => {
      tauriFsState.setDialogResult('/Users/me/Desktop/export.json')
      await exportShareGraphJson('graph.json', 'data')
      expect(tauriFsState.files.get('/Users/me/Desktop/export.json')).toBe('data')
    })

    describe.each([
      ['save_file_dialog is not supported on this platform', false, false],
      ['save_file_dialog is not supported on this platform', true, false],
      ['permission denied', false, true],
      ['permission denied', true, true],
      ['IPC error: connection lost', false, true],
    ])('error: "%s" (as %s)', (message, asString, shouldReject) => {
      it(shouldReject ? 'propagates the error' : 'falls back to browser download', async () => {
        if (asString) tauriFsState.setSaveFileDialogErrorAsString(true)
        tauriFsState.setSaveFileDialogError(message)

        if (shouldReject) {
          await expect(exportShareGraphJson('graph.json', '{}')).rejects.toThrow(message)
        } else {
          await expect(exportShareGraphJson('graph.json', '{}')).resolves.toBeUndefined()
          expect(tauriFsState.files.size).toBe(0)
        }
      })
    })
  })

  describe('web (no Tauri internals)', () => {
    beforeEach(() => {
      delete (window as unknown as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__
    })

    it('falls back to the browser save flow', async () => {
      await expect(exportShareGraphJson('graph.json', '{}')).resolves.toBeUndefined()
    })
  })
})
