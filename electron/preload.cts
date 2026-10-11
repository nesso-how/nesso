import type { UpdateBridge, UpdateState } from './updates.js'
import type { AiBridge } from './ai-bridge.js'
import type { AiChatEvent } from '@nesso/ai'
import type { McpBridge, McpEvent, McpState } from './mcp-bridge.js'
import type { PersistenceBridge } from '../shared/persistence.js'

const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')
const beforeSave = (request: string, reply: string, save: () => Promise<boolean>) => {
  const prepare = async () => {
    const saved = await Promise.resolve().then(save).catch(() => false)
    ipcRenderer.send(reply, saved)
  }
  ipcRenderer.on(request, prepare)
  return () => { ipcRenderer.removeListener(request, prepare) }
}

const updater: UpdateBridge = {
  subscribe: (listener) => {
    const receive = (_event: unknown, state: UpdateState) => listener(state)
    ipcRenderer.on('update:state', receive)
    ipcRenderer.send('update:subscribe')
    return () => { ipcRenderer.removeListener('update:state', receive) }
  },
  restart: () => ipcRenderer.send('update:restart'),
  beforeInstall: (save) => beforeSave('update:prepare', 'update:install', save),
}
contextBridge.exposeInMainWorld('nessoUpdater', updater)
const persistence: PersistenceBridge = {
  read: (section) => ipcRenderer.invoke('storage:read', section),
  write: (section, value) => ipcRenderer.invoke('storage:write', section, value),
  beforeClose: (save) => {
    const stop = beforeSave('storage:prepare', 'storage:closed', save)
    ipcRenderer.send('storage:ready')
    return stop
  },
}
contextBridge.exposeInMainWorld('nessoPersistence', persistence)
const ai: AiBridge = {
  list: () => ipcRenderer.invoke('ai:list'),
  save: (input) => ipcRenderer.invoke('ai:save', input),
  remove: (id) => ipcRenderer.invoke('ai:remove', id),
  activate: (id) => ipcRenderer.invoke('ai:activate', id),
  verify: (input) => ipcRenderer.invoke('ai:verify', input),
  models: (input) => ipcRenderer.invoke('ai:models', input),
  signIn: (id) => ipcRenderer.invoke('ai:sign-in', id),
  cancelSignIn: () => ipcRenderer.send('ai:cancel-sign-in'),
  signOut: (id) => ipcRenderer.invoke('ai:signOut', id),
  manageUsage: () => ipcRenderer.invoke('ai:manage-usage'),
  chat: (input) => ipcRenderer.invoke('ai:chat', input),
  stop: (id) => ipcRenderer.send('ai:stop', id),
  reply: (input) => ipcRenderer.send('ai:reply', input),
  subscribeChat: (listener) => {
    const receive = (_event: unknown, event: AiChatEvent) => listener(event)
    ipcRenderer.on('ai:chat-event', receive)
    return () => { ipcRenderer.removeListener('ai:chat-event', receive) }
  },
}
contextBridge.exposeInMainWorld('nessoAi', ai)
const mcp: McpBridge = {
  getState: () => ipcRenderer.invoke('mcp:state'),
  setEnabled: (enabled) => ipcRenderer.invoke('mcp:enabled', enabled),
  copyUrl: () => ipcRenderer.invoke('mcp:copy-url'),
  copyToken: () => ipcRenderer.invoke('mcp:copy-token'),
  regenerateAccess: () => ipcRenderer.invoke('mcp:regenerate'),
  subscribeState: (listener) => {
    const receive = (_event: unknown, state: McpState) => listener(state)
    ipcRenderer.on('mcp:state', receive)
    return () => { ipcRenderer.removeListener('mcp:state', receive) }
  },
  subscribeTools: (listener) => {
    const receive = (_event: unknown, event: McpEvent) => listener(event)
    ipcRenderer.on('mcp:tool', receive)
    ipcRenderer.send('mcp:ready')
    return () => { ipcRenderer.removeListener('mcp:tool', receive) }
  },
  disconnect: () => ipcRenderer.send('mcp:disconnect'),
  reply: (id, result) => ipcRenderer.send('mcp:reply', id, result),
}
contextBridge.exposeInMainWorld('nessoMcp', mcp)
