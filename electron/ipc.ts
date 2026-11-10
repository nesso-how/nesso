import { BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { ElectronError } from './errors.ts'

export type TrustedRequest = (event: IpcMainEvent | IpcMainInvokeEvent) => boolean

export function appUrl(dev: boolean): string {
  if (!dev) return 'nesso://app/'
  const port = Number(process.env.NESSO_DEV_PORT ?? 5173)
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new ElectronError([
      { path: 'NESSO_DEV_PORT', message: 'Expected a port between 1 and 65535' },
    ])
  return `http://127.0.0.1:${port}/`
}

export function createTrustedRequest(url: string): TrustedRequest {
  return (event) =>
    BrowserWindow.getAllWindows().some((window) => window.webContents === event.sender) &&
    event.senderFrame === event.sender.mainFrame &&
    event.senderFrame.url === url
}
