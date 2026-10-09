import type { UpdateBridge, UpdateState } from './updates.js'
import type { AiBridge } from './ai-bridge.js'
import type { AiChatEvent } from '@nesso/ai'
import type { McpBridge, McpEvent, McpState } from './mcp-bridge.js'

const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')
const updater: UpdateBridge = {
  subscribe: (listener) => {
    const receive = (_event: unknown, state: UpdateState) => listener(state)
    ipcRenderer.on('update:state', receive)
    ipcRenderer.send('update:subscribe')
    return () => { ipcRenderer.removeListener('update:state', receive) }
  },
  restart: () => ipcRenderer.send('update:restart'),
  beforeInstall: (save) => {
    const prepare = () => {
      let saved = false
      try {
        saved = save()
      } finally {
        ipcRenderer.send('update:install', saved)
      }
    }
    ipcRenderer.on('update:prepare', prepare)
    return () => { ipcRenderer.removeListener('update:prepare', prepare) }
  },
}
contextBridge.exposeInMainWorld('nessoUpdater', updater)
const ai: AiBridge = {
  list: () => ipcRenderer.invoke('ai:list'),
  save: (input) => ipcRenderer.invoke('ai:save', input),
  remove: (id) => ipcRenderer.invoke('ai:remove', id),
  activate: (id) => ipcRenderer.invoke('ai:activate', id),
  verify: (input) => ipcRenderer.invoke('ai:verify', input),
  models: (input) => ipcRenderer.invoke('ai:models', input),
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
