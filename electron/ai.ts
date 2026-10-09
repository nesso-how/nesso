import { app, BrowserWindow, ipcMain, safeStorage, shell, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import path from 'node:path'
import { createAiConnections } from './ai-connections.ts'
import { createAiStorage } from './ai-storage.ts'
import { aiChatRequest, type AiResult, type AiToolReply } from '@nesso/ai'
import { ElectronError } from './errors.ts'
import { createAiChatRun } from './ai-chat.ts'
import { createChatGptAuth } from './ai-oauth.ts'

export function connectAi(dev: boolean) {
  const file = path.join(app.getPath('userData'), 'ai-connections.enc')
  const connections = createAiConnections(createAiStorage(file, safeStorage), fetch, createChatGptAuth((url) => shell.openExternal(url)))
  const trustedUrl = dev ? 'http://127.0.0.1:5173/' : 'nesso://app/'
  const trusted = (event: IpcMainEvent | IpcMainInvokeEvent) =>
    BrowserWindow.getAllWindows().some((window) => window.webContents === event.sender)
    && event.senderFrame === event.sender.mainFrame && event.senderFrame.url === trustedUrl
  const runs = new Map<number, ReturnType<typeof createAiChatRun> & { accountId?: string }>()
  const preparing = new Map<number, { id: string; controller: AbortController }>()
  let signIn: { senderId: number; controller: AbortController } | undefined
  ipcMain.handle('ai:sign-in', async (event, id: unknown): Promise<AiResult<unknown>> => {
    if (!trusted(event)) return { issues: [{ path: 'desktop', message: 'Untrusted request' }] }
    if (signIn) return { issues: [{ path: 'oauth', message: 'ChatGPT sign-in is already running' }] }
    const attempt = { senderId: event.sender.id, controller: new AbortController() }
    signIn = attempt
    const cancel = () => attempt.controller.abort()
    event.sender.once('destroyed', cancel)
    event.sender.on('did-start-navigation', cancel)
    try { return { value: await connections.signIn(id, attempt.controller.signal) } } catch (error) {
      return { issues: error instanceof ElectronError ? error.issues : [{ path: 'oauth', message: 'ChatGPT sign-in failed' }] }
    } finally {
      event.sender.removeListener('destroyed', cancel)
      event.sender.removeListener('did-start-navigation', cancel)
      if (signIn === attempt) signIn = undefined
    }
  })
  ipcMain.on('ai:cancel-sign-in', (event) => { if (trusted(event) && signIn?.senderId === event.sender.id) signIn.controller.abort() })
  ipcMain.handle('ai:manage-usage', async (event): Promise<AiResult<true>> => {
    if (!trusted(event)) return { issues: [{ path: 'desktop', message: 'Untrusted request' }] }
    try { await shell.openExternal('https://chatgpt.com/settings/usage'); return { value: true } } catch {
      return { issues: [{ path: 'oauth', message: 'Could not open ChatGPT usage settings' }] }
    }
  })
  for (const method of ['list', 'save', 'remove', 'activate', 'verify', 'models', 'signOut'] as const) {
    ipcMain.handle(`ai:${method}`, async (event, input: unknown): Promise<AiResult<unknown>> => {
      if (!trusted(event)) {
        return { issues: [{ path: 'desktop', message: 'Untrusted request' }] }
      }
      try {
        if (method === 'signOut') {
          if (signIn) throw new ElectronError([{ path: 'oauth', message: 'Finish or cancel ChatGPT sign-in before signing out' }])
          for (const run of runs.values()) if (run.accountId === input) run.cancel()
          for (const pending of preparing.values()) pending.controller.abort()
        }
        return { value: await connections[method](input) }
      } catch (error) {
        return { issues: error instanceof ElectronError ? error.issues : [{ path: 'desktop', message: 'AI connection operation failed' }] }
      }
    })
  }
  ipcMain.handle('ai:chat', async (event, value: unknown): Promise<AiResult<true>> => {
    if (!trusted(event)) return { issues: [{ path: 'desktop', message: 'Untrusted request' }] }
    const senderId = event.sender.id
    if (runs.has(senderId) || preparing.has(senderId)) return { issues: [{ path: 'chat', message: 'A request is already running' }] }
    const parsed = aiChatRequest.safeParse(value)
    if (!parsed.success) return { issues: [{ path: 'chat', message: 'Invalid chat request' }] }
    let run: ReturnType<typeof createAiChatRun> | undefined
    const controller = new AbortController()
    preparing.set(senderId, { id: parsed.data.id, controller })
    const cancel = () => { controller.abort(); run?.cancel() }
    event.sender.once('destroyed', cancel)
    event.sender.on('did-start-navigation', cancel)
    try {
      const entry = await connections.active()
      controller.signal.throwIfAborted()
      run = createAiChatRun(entry, parsed.data, (message) => {
        if (!event.sender.isDestroyed()) event.sender.send('ai:chat-event', message)
      })
      runs.set(senderId, Object.assign(run, { accountId: entry.accountId }))
      preparing.delete(senderId)
      return { value: await run.result }
    } catch (error) {
      return { issues: error instanceof ElectronError ? error.issues : [{ path: 'chat', message: 'Chat request failed' }] }
    } finally {
      event.sender.removeListener('destroyed', cancel)
      event.sender.removeListener('did-start-navigation', cancel)
      if (runs.get(senderId) === run) runs.delete(senderId)
      preparing.delete(senderId)
    }
  })
  ipcMain.on('ai:stop', (event, id: unknown) => {
    if (trusted(event) && runs.get(event.sender.id)?.id === id) runs.get(event.sender.id)?.cancel()
    if (trusted(event) && preparing.get(event.sender.id)?.id === id) preparing.get(event.sender.id)?.controller.abort()
  })
  ipcMain.on('ai:reply', (event, input: AiToolReply) => {
    if (!trusted(event) || !input || typeof input.callId !== 'string' || !input.result || typeof input.result !== 'object'
      || !('value' in input.result || 'issues' in input.result)) return
    runs.get(event.sender.id)?.reply(input)
  })
  app.on('before-quit', () => {
    signIn?.controller.abort()
    for (const run of runs.values()) run.cancel()
    for (const pending of preparing.values()) pending.controller.abort()
  })
}
