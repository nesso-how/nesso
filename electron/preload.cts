import type { UpdateBridge, UpdateState } from './updates.js'
import type { AiBridge } from './ai-bridge.js'
import type { AiChatEvent } from '@nesso/ai'

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
