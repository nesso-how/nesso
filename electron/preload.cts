import type { UpdateBridge, UpdateState } from './updates.js'
import type { AiBridge } from './ai-bridge.js'
import type { AiChatEvent } from '@nesso-how/ai'
import type { McpBridge, McpEvent, McpState } from './mcp-bridge.js'
import type { PersistenceBridge } from '../shared/persistence.js'
import type { DataLocationBridge, DataLocationState } from '../shared/data-location.js'
import type { FileBridge } from '../shared/files.js'
import type { PluginBridge } from '../shared/plugins.js'

const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')
const beforeSave = (request: string, reply: string, save: () => Promise<boolean>) => {
  const prepare = async () => {
    const saved = await Promise.resolve()
      .then(save)
      .catch(() => false)
    ipcRenderer.send(reply, saved)
  }
  ipcRenderer.on(request, prepare)
  return () => {
    ipcRenderer.removeListener(request, prepare)
  }
}

const updater: UpdateBridge = {
  subscribe: (listener) => {
    const receive = (_event: unknown, state: UpdateState) => listener(state)
    ipcRenderer.on('update:state', receive)
    ipcRenderer.send('update:subscribe')
    return () => {
      ipcRenderer.removeListener('update:state', receive)
    }
  },
  restart: () => ipcRenderer.send('update:restart'),
  beforeInstall: (save) => beforeSave('update:prepare', 'update:install', save),
}
contextBridge.exposeInMainWorld('nessoUpdater', updater)
const persistence: PersistenceBridge = {
  read: (section) => ipcRenderer.invoke('storage:read', section),
  write: (section, value) => ipcRenderer.invoke('storage:write', section, value),
  beforeClose: (save, confirm) => {
    const stop = beforeSave('storage:prepare', 'storage:closed', async () => {
      if (
        await Promise.resolve()
          .then(save)
          .catch(() => false)
      )
        return true
      ipcRenderer.send('storage:confirming')
      return confirm()
    })
    ipcRenderer.send('storage:ready')
    return stop
  },
}
contextBridge.exposeInMainWorld('nessoPersistence', persistence)
const dataLocation: DataLocationBridge = {
  getState: () => ipcRenderer.invoke('data-location:state'),
  choose: () => ipcRenderer.invoke('data-location:choose'),
  validate: (directory) => ipcRenderer.invoke('data-location:validate', directory),
  move: (directory) => ipcRenderer.invoke('data-location:move', directory),
  open: () => ipcRenderer.invoke('data-location:open'),
  retryCleanup: () => ipcRenderer.invoke('data-location:cleanup'),
  subscribe: (listener) => {
    const receive = (_event: unknown, state: DataLocationState) => listener(state)
    ipcRenderer.on('data-location:state', receive)
    return () => {
      ipcRenderer.removeListener('data-location:state', receive)
    }
  },
  beforeMove: (save) => {
    const prepare = async (_event: unknown, id: string) => {
      const saved = await Promise.resolve()
        .then(save)
        .catch(() => false)
      ipcRenderer.send('data-location:prepared', id, saved)
    }
    ipcRenderer.on('data-location:prepare', prepare)
    return () => {
      ipcRenderer.removeListener('data-location:prepare', prepare)
    }
  },
}
contextBridge.exposeInMainWorld('nessoDataLocation', dataLocation)
const files: FileBridge = {
  open: (id, options) => ipcRenderer.invoke('files:open', id, options),
  save: (id, options) => ipcRenderer.invoke('files:save', id, options),
  cancel: (id) => ipcRenderer.send('files:cancel', id),
}
contextBridge.exposeInMainWorld('nessoFiles', files)
let pluginSubscribers = 0
const plugins: PluginBridge = {
  list: () => ipcRenderer.invoke('plugins:list'),
  search: (query, offset) => ipcRenderer.invoke('plugins:search', query, offset),
  latest: (name) => ipcRenderer.invoke('plugins:latest', name),
  propose: (id, input, locale, replacing) =>
    ipcRenderer.invoke('plugins:propose', id, input, locale, replacing),
  installNpm: (id, input, locale, replacing) =>
    ipcRenderer.invoke('plugins:npm', id, input, locale, replacing),
  settle: (id, contentId, valid) => ipcRenderer.invoke('plugins:settle', id, contentId, valid),
  cancel: (id) => ipcRenderer.send('plugins:cancel', id),
  approve: (challenge, allow) => ipcRenderer.invoke('plugins:approve', challenge, allow),
  remove: (contentId) => ipcRenderer.invoke('plugins:remove', contentId),
  setEnabled: (contentId, enabled) => ipcRenderer.invoke('plugins:enabled', contentId, enabled),
  subscribe: (listener, runtime = false) => {
    const receive = (_event: unknown, event: Parameters<typeof listener>[0]) => listener(event)
    let active = true
    ipcRenderer.on('plugins:event', receive)
    if (runtime && ++pluginSubscribers === 1) ipcRenderer.send('plugins:ready')
    return () => {
      if (!active) return
      active = false
      ipcRenderer.removeListener('plugins:event', receive)
      if (runtime && --pluginSubscribers === 0) ipcRenderer.send('plugins:disconnect')
    }
  },
}
contextBridge.exposeInMainWorld('nessoPlugins', plugins)
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
    return () => {
      ipcRenderer.removeListener('ai:chat-event', receive)
    }
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
    return () => {
      ipcRenderer.removeListener('mcp:state', receive)
    }
  },
  subscribeTools: (listener) => {
    const receive = (_event: unknown, event: McpEvent) => listener(event)
    ipcRenderer.on('mcp:tool', receive)
    ipcRenderer.send('mcp:ready')
    return () => {
      ipcRenderer.removeListener('mcp:tool', receive)
    }
  },
  disconnect: () => ipcRenderer.send('mcp:disconnect'),
  reply: (id, result) => ipcRenderer.send('mcp:reply', id, result),
}
contextBridge.exposeInMainWorld('nessoMcp', mcp)
