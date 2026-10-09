import { app, BrowserWindow, clipboard, ipcMain, safeStorage, type IpcMainEvent, type IpcMainInvokeEvent, type WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { z } from 'zod'
import type { AiResult } from '@nesso/ai'
import { ElectronError } from './errors.ts'
import { startMcpServer } from './mcp-server.ts'
import type { McpEvent, McpState } from './mcp-bridge.ts'
import { createMcpAccess } from './mcp-access.ts'
import { createAiStorage } from './ai-storage.ts'

const replySchema = z.union([
  z.strictObject({ value: z.json() }),
  z.strictObject({ issues: z.array(z.strictObject({ path: z.string(), message: z.string() })).min(1) }),
])

const stoppedUrl = 'http://127.0.0.1:3210/mcp'

export function connectMcp(dev: boolean) {
  const access = createMcpAccess(createAiStorage(path.join(app.getPath('userData'), 'mcp-access.enc'), safeStorage))
  const url = dev ? 'http://127.0.0.1:5173/' : 'nesso://app/'
  const trusted = (event: IpcMainEvent | IpcMainInvokeEvent) =>
    BrowserWindow.getAllWindows().some((window) => window.webContents === event.sender)
    && event.senderFrame === event.sender.mainFrame && event.senderFrame.url === url
  let host: WebContents | undefined
  let server: Awaited<ReturnType<typeof startMcpServer>> | undefined
  let changing = false
  let pending: { id: string; finish: (result: AiResult<unknown>) => void } | undefined
  const snapshot = (): McpState => ({ url: server?.state.url ?? stoppedUrl, token: access.get(), running: !!server })
  const current = (): AiResult<McpState> => {
    try {
      return { value: snapshot() }
    } catch (error) {
      return { issues: error instanceof ElectronError ? error.issues : [{ path: 'mcp', message: 'MCP server operation failed' }] }
    }
  }
  const publish = () => {
    if (host && !host.isDestroyed()) {
      try {
        host.send('mcp:state', snapshot())
      } catch { /* best effort */ }
    }
  }
  const stop = async () => {
    const previous = server
    server = undefined
    pending?.finish({ issues: [{ path: 'mcp', message: 'MCP request cancelled' }] })
    publish()
    await previous?.close()
  }
  const start = async (owner: WebContents) => {
    const next = await startMcpServer((name, input, signal) => new Promise((resolve) => {
      if (signal.aborted || host !== owner || owner.isDestroyed()) { resolve({ issues: [{ path: 'mcp', message: 'The document is unavailable' }] }); return }
      if (pending) { resolve({ issues: [{ path: 'mcp', message: 'Another MCP request is running' }] }); return }
      const id = randomUUID()
      const finish = (result: AiResult<unknown>) => {
        if (pending?.id !== id) return
        pending = undefined
        signal.removeEventListener('abort', cancel)
        if (!owner.isDestroyed()) owner.send('mcp:tool', { type: 'cancel', id } satisfies McpEvent)
        resolve(result)
      }
      const cancel = () => finish({ issues: [{ path: 'mcp', message: 'MCP request cancelled or timed out' }] })
      pending = { id, finish }
      signal.addEventListener('abort', cancel, { once: true })
      owner.send('mcp:tool', { type: 'tool', id, name, input } satisfies McpEvent)
    }), app.getVersion(), access.get())
    if (host !== owner || owner.isDestroyed()) { await next.close(); throw new ElectronError([{ path: 'mcp', message: 'The document is unavailable' }]) }
    server = next
    publish()
  }
  const copyText = (text: string): AiResult<true> => {
    try {
      clipboard.writeText(text)
      return { value: true }
    } catch { return { issues: [{ path: 'mcp', message: 'Could not copy from Nesso' }] } }
  }
  const disconnected = () => {
    void stop()
    host?.removeListener('destroyed', disconnected)
    host?.removeListener('did-start-navigation', disconnected)
    host = undefined
  }
  ipcMain.on('mcp:ready', (event) => {
    if (!trusted(event) || host) return
    host = event.sender
    host.once('destroyed', disconnected)
    host.on('did-start-navigation', disconnected)
  })
  ipcMain.on('mcp:disconnect', (event) => { if (trusted(event) && host === event.sender) disconnected() })
  ipcMain.on('mcp:reply', (event, id: unknown, value: unknown) => {
    if (!trusted(event) || host !== event.sender || !pending || pending.id !== id) return
    const parsed = replySchema.safeParse(value)
    pending.finish(parsed.success ? parsed.data : { issues: [{ path: 'mcp', message: 'Invalid host response' }] })
  })
  ipcMain.handle('mcp:state', (event): AiResult<McpState> => trusted(event)
    ? current() : { issues: [{ path: 'mcp', message: 'Untrusted request' }] })
  const copyOf = (event: IpcMainInvokeEvent, text: (state: McpState) => string): AiResult<true> => {
    if (!trusted(event)) return { issues: [{ path: 'mcp', message: 'Untrusted request' }] }
    const state = current()
    if ('issues' in state) return state
    return copyText(text(state.value))
  }
  ipcMain.handle('mcp:copy-url', (event): AiResult<true> => copyOf(event, ({ url }) => url))
  ipcMain.handle('mcp:copy-token', (event): AiResult<true> => copyOf(event, ({ token }) => token))
  ipcMain.handle('mcp:regenerate', async (event): Promise<AiResult<McpState>> => {
    if (!trusted(event)) return { issues: [{ path: 'mcp', message: 'Untrusted request' }] }
    if (changing) return { issues: [{ path: 'mcp', message: 'MCP server is starting or stopping' }] }
    changing = true
    try {
      const wasRunning = !!server
      const owner = host
      await stop()
      access.revoke()
      if (wasRunning && owner && !owner.isDestroyed() && host === owner) await start(owner)
      else publish()
      return current()
    } catch (error) {
      return { issues: error instanceof ElectronError ? error.issues : [{ path: 'mcp', message: 'Could not regenerate the MCP token' }] }
    } finally { changing = false }
  })
  ipcMain.handle('mcp:enabled', async (event, enabled: unknown): Promise<AiResult<McpState>> => {
    if (!trusted(event) || typeof enabled !== 'boolean') return { issues: [{ path: 'mcp', message: 'Invalid request' }] }
    if (changing) return { issues: [{ path: 'mcp', message: 'MCP server is starting or stopping' }] }
    changing = true
    try {
      if (!enabled) await stop()
      else if (!server) {
        if (!host || host !== event.sender) throw new ElectronError([{ path: 'mcp', message: 'The document is not ready' }])
        await start(host)
      }
      return current()
    } catch (error) {
      return { issues: error instanceof ElectronError ? error.issues : [{ path: 'mcp', message: 'MCP server operation failed' }] }
    } finally { changing = false }
  })
  app.on('before-quit', () => { void stop() })
}
