import { BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'

export type TrustedRequest = (event: IpcMainEvent | IpcMainInvokeEvent) => boolean

export function createTrustedRequest(dev: boolean): TrustedRequest {
  const url = dev ? 'http://127.0.0.1:5173/' : 'nesso://app/'
  return (event) =>
    BrowserWindow.getAllWindows().some((window) => window.webContents === event.sender) &&
    event.senderFrame === event.sender.mainFrame &&
    event.senderFrame.url === url
}
