import type { UpdateBridge, UpdateState } from './updates.js'

const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')
const bridge: UpdateBridge = {
  subscribe: (listener) => {
    const receive = (_event: unknown, state: UpdateState) => listener(state)
    ipcRenderer.on('update:state', receive)
    ipcRenderer.send('update:subscribe')
    return () => { ipcRenderer.removeListener('update:state', receive) }
  },
  download: () => ipcRenderer.invoke('update:download'),
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
contextBridge.exposeInMainWorld('nessoUpdater', bridge)
