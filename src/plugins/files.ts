import { fileTextLimit, parseFileOptions, PluginError, type FileOpenOptions, type FileOpenResult, type FileSaveOptions } from '@nesso-how/plugin/runtime'
import type { FileBridge } from '../../shared/files.ts'

type PickerHost = {
  readonly showSaveFilePicker?: (options: { readonly suggestedName: string }) => Promise<{
    readonly createWritable: () => Promise<Pick<FileSystemWritableFileStream, 'write' | 'close' | 'abort'>>
  }>
}

export function createPluginFiles(bridge: FileBridge | undefined, signal: AbortSignal) {
  const closed = () => new PluginError('closed', [{ path: 'files', message: 'Plugin channel closed' }])
  const unavailable = () => new PluginError('unavailable', [{ path: 'files', message: 'Host interaction failed' }])
  const direct = <T>(run: (id: string) => Promise<T>): Promise<T> => {
    if (signal.aborted) return Promise.reject(closed())
    const id = crypto.randomUUID()
    const onAbort = () => bridge!.cancel(id)
    signal.addEventListener('abort', onAbort, { once: true })
    return run(id).catch((error: unknown) => {
      throw error instanceof PluginError ? error : unavailable()
    }).finally(() => signal.removeEventListener('abort', onAbort))
  }
  const browserOpen = (options: FileOpenOptions): Promise<FileOpenResult> => new Promise((resolve, reject) => {
    if (signal.aborted) { reject(closed()); return }
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = [...options.extensions.map((extension) => `.${extension}`), ...options.mimeTypes].join(',')
    input.hidden = true
    const cleanup = () => { signal.removeEventListener('abort', abort); input.remove() }
    const abort = () => { cleanup(); reject(closed()) }
    input.oncancel = () => { cleanup(); resolve(null) }
    input.onchange = () => {
      const file = input.files?.[0]
      cleanup()
      if (!file) { resolve(null); return }
      if (file.size > fileTextLimit) { reject(new PluginError('invalid-input', [{ path: 'files', message: 'File limit exceeded' }])); return }
      void file.arrayBuffer().then((bytes) => {
        if (signal.aborted) throw closed()
        if (bytes.byteLength > fileTextLimit) throw new PluginError('invalid-input', [{ path: 'files', message: 'File limit exceeded' }])
        return { name: file.name, mediaType: file.type || 'application/octet-stream', text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
      }).then(resolve, reject)
    }
    signal.addEventListener('abort', abort, { once: true })
    document.body.append(input)
    input.click()
  })
  const browserSave = async (options: FileSaveOptions): Promise<{ saved: boolean }> => {
    if (signal.aborted) return Promise.reject(closed())
    const picker = (globalThis as PickerHost).showSaveFilePicker
    if (picker) {
      try {
        let onAbort: (() => void) | undefined
        const handle = await Promise.race([
          picker({ suggestedName: options.name }).finally(() => { if (onAbort) signal.removeEventListener('abort', onAbort) }),
          new Promise<never>((_resolve, reject) => { onAbort = () => reject(closed()); signal.addEventListener('abort', onAbort, { once: true }) }),
        ])
        if (!handle || signal.aborted) return { saved: false }
        const writable = await handle.createWritable()
        const abort = () => { void writable.abort().catch(() => {}) }
        if (signal.aborted) { await writable.abort(); return { saved: false } }
        signal.addEventListener('abort', abort, { once: true })
        try {
          await writable.write(options.text)
          if (signal.aborted) return { saved: false }
          await writable.close()
          return { saved: !signal.aborted }
        } finally { signal.removeEventListener('abort', abort) }
      } catch (error: unknown) {
        if (error instanceof PluginError) throw error
        if (error instanceof DOMException && error.name === 'AbortError') return { saved: false }
        if (!(error instanceof DOMException && (error.name === 'SecurityError' || error.name === 'NotAllowedError'))) throw unavailable()
      }
    }
    const url = URL.createObjectURL(new Blob([options.text], { type: options.mediaType }))
    try {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = options.name
      anchor.click()
      return { saved: true }
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000) }
  }
  return {
    open: (input: FileOpenOptions) => {
      const options = parseFileOptions('open', input)
      if (bridge) return direct((id) => bridge.open(id, options))
      return browserOpen(options).catch((error: unknown) => {
        throw error instanceof PluginError ? error : unavailable()
      })
    },
    save: (input: FileSaveOptions) => {
      const options = parseFileOptions('save', input)
      if (bridge) return direct((id) => bridge.save(id, options))
      return browserSave(options)
    },
  }
}
