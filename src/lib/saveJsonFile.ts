// SPDX-License-Identifier: MIT
import { isDesktop } from '@/lib/isDesktop'

const exportHandles = new Map<string, FileSystemFileHandleWithPermission>()

function downloadViaAnchor(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function writeToHandle(
  handle: FileSystemFileHandleWithPermission,
  contents: string,
): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(contents)
  await writable.close()
}

export async function saveJsonFileForGraph(
  graphId: string,
  filename: string,
  contents: string,
): Promise<void> {
  const saveFilePicker = window.showSaveFilePicker
  if (saveFilePicker) {
    const cached = exportHandles.get(graphId)
    if (cached) {
      const permission = await cached.queryPermission({ mode: 'readwrite' })
      if (permission === 'granted') {
        await writeToHandle(cached, contents)
        return
      }
    }

    try {
      const handle = await saveFilePicker({
        suggestedName: filename,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      })
      await writeToHandle(handle, contents)
      exportHandles.set(graphId, handle)
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      throw err
    }
  }

  downloadViaAnchor(filename, contents)
}

/**
 * Attempt a native save_file_dialog export on desktop Tauri.
 * Returns `true` when the dialog was shown (user picked a path or cancelled),
 * `false` when the platform doesn't support the command (fall through to
 * browser-based export).
 * Real native errors propagate so the caller can surface them.
 */
async function tryDesktopSave(filename: string, contents: string): Promise<boolean> {
  if (!isDesktop()) return false
  const { invoke } = await import('@tauri-apps/api/core')
  try {
    const path = await invoke('save_file_dialog', { defaultName: filename, contents })
    if (!path) return true // user cancelled — still handled on desktop
    return true
  } catch (err) {
    // Only catch the known unsupported-platform error from the Rust
    // mobile stub.  Real native failures (permission denied, disk
    // full, IPC errors) must propagate so the caller can surface them.
    // Tauri invoke() can reject with strings as well as Error objects.
    const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : ''
    if (msg.includes('save_file_dialog is not supported on this platform')) {
      return false // fall through to browser-based export
    }
    throw err
  }
}

/** Share-safe graph JSON: Rust-owned native save dialog on desktop, File System Access API or download on web. */
export async function exportShareGraphJson(filename: string, contents: string): Promise<void> {
  if (await tryDesktopSave(filename, contents)) return
  await saveJsonFileForGraph('share-export', filename, contents)
}
