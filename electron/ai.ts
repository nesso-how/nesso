import { app, BrowserWindow, ipcMain, safeStorage, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import path from 'node:path'
import { createAiConnections } from './ai-connections.ts'
import { createAiStorage } from './ai-storage.ts'
import { aiChatRequest, type AiResult, type AiToolReply } from '@nesso/ai'
import { ElectronError } from './errors.ts'
import { createAiChatRun } from './ai-chat.ts'

export function connectAi(dev: boolean) {
  const file = path.join(app.getPath('userData'), 'ai-connections.enc')
  const connections = createAiConnections(createAiStorage(file, safeStorage))
  const trustedUrl = dev ? 'http://127.0.0.1:5173/' : 'nesso://app/'
  const trusted = (event: IpcMainEvent | IpcMainInvokeEvent) =>
    BrowserWindow.getAllWindows().some((window) => window.webContents === event.sender)
    && event.senderFrame === event.sender.mainFrame && event.senderFrame.url === trustedUrl
  for (const method of ['list', 'save', 'remove', 'activate', 'verify', 'models'] as const) {
    ipcMain.handle(`ai:${method}`, async (event, input: unknown): Promise<AiResult<unknown>> => {
      if (!trusted(event)) {
        return { issues: [{ path: 'desktop', message: 'Untrusted request' }] }
      }
      try { return { value: await connections[method](input) } } catch (error) {
        return { issues: error instanceof ElectronError ? error.issues : [{ path: 'desktop', message: 'AI connection operation failed' }] }
      }
    })
  }
  const runs = new Map<number, ReturnType<typeof createAiChatRun>>()
  ipcMain.handle('ai:chat', async (event, value: unknown): Promise<AiResult<true>> => {
    if (!trusted(event)) return { issues: [{ path: 'desktop', message: 'Untrusted request' }] }
    const senderId = event.sender.id
    if (runs.has(senderId)) return { issues: [{ path: 'chat', message: 'A request is already running' }] }
    const parsed = aiChatRequest.safeParse(value)
    if (!parsed.success) return { issues: [{ path: 'chat', message: 'Invalid chat request' }] }
    let run: ReturnType<typeof createAiChatRun> | undefined
    const cancel = () => run?.cancel()
    try {
      run = createAiChatRun(connections.active(), parsed.data, (message) => {
        if (!event.sender.isDestroyed()) event.sender.send('ai:chat-event', message)
      })
      runs.set(senderId, run)
      event.sender.once('destroyed', cancel)
      event.sender.on('did-start-navigation', cancel)
      return { value: await run.result }
    } catch (error) {
      return { issues: error instanceof ElectronError ? error.issues : [{ path: 'chat', message: 'Chat request failed' }] }
    } finally {
      event.sender.removeListener('destroyed', cancel)
      event.sender.removeListener('did-start-navigation', cancel)
      if (runs.get(senderId) === run) runs.delete(senderId)
    }
  })
  ipcMain.on('ai:stop', (event, id: unknown) => {
    if (trusted(event) && runs.get(event.sender.id)?.id === id) runs.get(event.sender.id)?.cancel()
  })
  ipcMain.on('ai:reply', (event, input: AiToolReply) => {
    if (!trusted(event) || !input || typeof input.callId !== 'string' || !input.result || typeof input.result !== 'object'
      || !('value' in input.result || 'issues' in input.result)) return
    runs.get(event.sender.id)?.reply(input)
  })
  app.on('before-quit', () => { for (const run of runs.values()) run.cancel() })
}
