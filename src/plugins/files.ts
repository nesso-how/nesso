import { fileTextLimit, parseFileOptions, PluginError, type FileOpenOptions, type FileOpenResult, type FileSaveOptions } from '@nesso/plugin/runtime'
import type { Notifications } from '@nesso/plugin'
import type { FileBridge } from '../../shared/files.ts'
import type { translate } from '../i18n/index.ts'
import { requestPluginGesture } from './gesture.ts'

type PickerHost = {
  readonly showSaveFilePicker?: (options: { readonly suggestedName: string }) => Promise<{
    readonly createWritable: () => Promise<Pick<FileSystemWritableFileStream, 'write' | 'close' | 'abort'>>
  }>
}

export function createPluginFiles(bridge: FileBridge | undefined, notifications: Notifications, signal: AbortSignal, getTranslation: () => ReturnType<typeof translate>) {
  const interact = <T>(read: boolean, cancelled: T, run: (id: string, signal: AbortSignal) => Promise<T>): Promise<T> => {
    const request = crypto.randomUUID()
    const controller = new AbortController()
    const t = getTranslation()
    return requestPluginGesture(notifications, signal, {
      path: 'files', title: t(read ? 'pluginOpenFile' : 'pluginSaveFile'), description: t('pluginFileGesture'), cancelLabel: t('cancel'),
      run: () => run(request, controller.signal), cancel: () => cancelled, revoke: () => { controller.abort(); bridge?.cancel(request) },
    })
  }
  const browserOpen = (options: FileOpenOptions, signal: AbortSignal): Promise<FileOpenResult> => new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = [...options.extensions.map((extension) => `.${extension}`), ...options.mimeTypes].join(',')
    input.hidden = true
    const cleanup = () => { signal.removeEventListener('abort', abort); input.remove() }
    const abort = () => { cleanup(); reject(new PluginError('closed', [{ path: 'files', message: 'File picker closed' }])) }
    input.oncancel = () => { cleanup(); resolve(null) }
    input.onchange = () => {
      const file = input.files?.[0]
      cleanup()
      if (!file) { resolve(null); return }
      if (file.size > fileTextLimit) { reject(new PluginError('invalid-input', [{ path: 'files', message: 'File limit exceeded' }])); return }
      void file.arrayBuffer().then((bytes) => {
        if (signal.aborted) throw new PluginError('closed', [{ path: 'files', message: 'Plugin channel closed' }])
        if (bytes.byteLength > fileTextLimit) throw new PluginError('invalid-input', [{ path: 'files', message: 'File limit exceeded' }])
        return { name: file.name, mediaType: file.type || 'application/octet-stream', text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
      }).then(resolve, reject)
    }
    signal.addEventListener('abort', abort, { once: true })
    document.body.append(input)
    input.click()
  })
  const browserSave = async (options: FileSaveOptions, signal: AbortSignal): Promise<{ saved: boolean }> => {
    const picker = (globalThis as PickerHost).showSaveFilePicker
    if (picker) {
      const handle = await picker({ suggestedName: options.name }).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return null
        throw error
      })
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
      return interact<FileOpenResult>(true, null, (id, signal) => bridge ? bridge.open(id, options) : browserOpen(options, signal))
    },
    save: (input: FileSaveOptions) => {
      const options = parseFileOptions('save', input)
      return interact(false, { saved: false }, (id, signal) => bridge ? bridge.save(id, options) : browserSave(options, signal))
    },
  }
}
