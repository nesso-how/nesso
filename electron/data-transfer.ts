import { randomUUID } from 'node:crypto'
import type { ipcMain, IpcMainEvent, WebContents } from 'electron'
import type { TrustedRequest } from './ipc.ts'
import { ElectronError } from './errors.ts'
import { onDocumentNavigation } from './navigation.ts'

export async function prepareDataTransfer(
  windows: readonly WebContents[],
  ipc: Pick<typeof ipcMain, 'on' | 'removeListener'>,
  trusted: TrustedRequest,
  timeout = 10_000,
) {
  const id = randomUUID()
  const pending = new Set(windows.map((window) => window.id))
  let receive: (event: IpcMainEvent, request: unknown, saved: unknown) => void = () => {}
  let fail: () => void = () => {}
  let timer: ReturnType<typeof setTimeout> | undefined
  const stopNavigation: (() => void)[] = []
  try {
    await new Promise<void>((resolve, reject) => {
      fail = () =>
        reject(new ElectronError([{ path: 'dataLocation', message: 'storageSaveFailure' }]))
      receive = (event, request, saved) => {
        if (!trusted(event) || request !== id || !pending.has(event.sender.id)) return
        if (saved !== true) {
          fail()
          return
        }
        pending.delete(event.sender.id)
        if (!pending.size) resolve()
      }
      timer = setTimeout(fail, timeout)
      ipc.on('data-location:prepared', receive)
      for (const window of windows) {
        window.once('destroyed', fail)
        stopNavigation.push(onDocumentNavigation(window, fail))
        window.send('data-location:prepare', id)
      }
      if (!pending.size) resolve()
    })
  } finally {
    clearTimeout(timer)
    ipc.removeListener('data-location:prepared', receive)
    for (const window of windows) window.removeListener('destroyed', fail)
    for (const stop of stopNavigation) stop()
  }
}
