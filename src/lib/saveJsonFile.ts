// SPDX-License-Identifier: MIT

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

async function writeToHandle(handle: FileSystemFileHandleWithPermission, contents: string): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(contents)
  await writable.close()
}

export async function saveJsonFileForGraph(
  graphId: string,
  filename: string,
  contents: string,
  confirmOverwrite: (filename: string) => boolean,
): Promise<void> {
  const saveFilePicker = window.showSaveFilePicker
  if (saveFilePicker) {
    const cached = exportHandles.get(graphId)
    if (cached) {
      const permission = await cached.queryPermission({ mode: 'readwrite' })
      if (permission === 'granted') {
        if (!confirmOverwrite(filename)) return
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
