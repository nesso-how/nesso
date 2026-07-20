// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import { describe, expect, it, beforeEach, vi } from 'vitest'

// Pre-load the Tauri mocks so dynamic imports resolve.
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

    it('writes via the native save_file_dialog command and returns early', async () => {
      tauriFsState.setDialogResult('/Users/me/Desktop/export.json')

      await exportShareGraphJson('MyGraph.json', '{"version":1}')

      // The fake core writes contents to the file store during `save_file_dialog`.
      expect(tauriFsState.files.get('/Users/me/Desktop/export.json')).toBe('{"version":1}')
    })

    it('returns early without writing when the user cancels the dialog', async () => {
      tauriFsState.setDialogResult(null)

      await exportShareGraphJson('MyGraph.json', '{"version":1}')

      // No file written — the cancel was handled.
      expect(tauriFsState.files.size).toBe(0)
    })

    it('does not require the path to be under a .nesso directory', async () => {
      // The Rust side owns the dialog and the write, so an arbitrary user-chosen
      // path like ~/Desktop works despite the minimal fs capability scope.
      tauriFsState.setDialogResult('/Users/me/Desktop/export.json')

      await exportShareGraphJson('graph.json', 'data')

      expect(tauriFsState.files.get('/Users/me/Desktop/export.json')).toBe('data')
    })

    it('falls back to browser download when save_file_dialog throws (non-desktop Tauri)', async () => {
      // Simulate the non-desktop Tauri platform where `save_file_dialog`
      // is unsupported and the Rust stub throws a specific error.  The frontend
      // must catch only this known message and fall back to the browser-based
      // export instead of silently failing.
      tauriFsState.setSaveFileDialogError('save_file_dialog is not supported on this platform')

      // Should not throw — the catch block in exportShareGraphJson
      // recovers and falls through to saveJsonFileForGraph.
      await expect(exportShareGraphJson('graph.json', '{}')).resolves.toBeUndefined()

      // No file was written (the browser fallback doesn't use the fake fs).
      expect(tauriFsState.files.size).toBe(0)
    })

    it('propagates real native dialog/write failures instead of silently catching them', async () => {
      // A genuine native failure (e.g., permission denied, disk full)
      // must NOT be silently caught — it must propagate so the caller
      // can surface the error to the user.
      tauriFsState.setSaveFileDialogError('permission denied')

      await expect(exportShareGraphJson('graph.json', '{}')).rejects.toThrow('permission denied')
    })

    it('propagates unexpected invoke errors (network, IPC) instead of silently catching them', async () => {
      tauriFsState.setSaveFileDialogError('IPC error: connection lost')

      await expect(exportShareGraphJson('graph.json', '{}')).rejects.toThrow('IPC error')
    })

    it('falls back when the unsupported-platform error is a plain string (mobile Tauri rejections)', async () => {
      // Real Tauri invoke() can reject with strings rather than Error
      // objects on non-desktop builds.  The unsupported-platform message
      // must still trigger the browser fallback.
      tauriFsState.setSaveFileDialogErrorAsString(true)
      tauriFsState.setSaveFileDialogError('save_file_dialog is not supported on this platform')

      await expect(exportShareGraphJson('graph.json', '{}')).resolves.toBeUndefined()
      expect(tauriFsState.files.size).toBe(0)
    })

    it('propagates real failures even when thrown as a plain string', async () => {
      // A genuine failure thrown as a plain string (non-Error rejection
      // from invoke on mobile) must still propagate.
      tauriFsState.setSaveFileDialogErrorAsString(true)
      tauriFsState.setSaveFileDialogError('permission denied')

      await expect(exportShareGraphJson('graph.json', '{}')).rejects.toThrow('permission denied')
    })
  })

  describe('web (no Tauri internals)', () => {
    beforeEach(() => {
      delete (window as unknown as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__
    })

    it('falls back to the browser save flow on web', async () => {
      // On web without showSaveFilePicker, it calls downloadViaAnchor.
      // We verify it does not throw (no mock needed for the anchor click).
      await expect(exportShareGraphJson('graph.json', '{}')).resolves.toBeUndefined()
    })
  })
})
