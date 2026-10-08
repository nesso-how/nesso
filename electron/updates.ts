import type { AppUpdater } from 'electron-updater'
import type { AutoUpdater } from 'electron'
import { ElectronError } from './errors.ts'

export type UpdateState = {
  status: 'available' | 'downloading' | 'installing'
  percent?: number
  error?: 'download' | 'save'
} | null

export type UpdateBridge = {
  subscribe: (listener: (state: UpdateState) => void) => () => void
  download: () => Promise<void>
  beforeInstall: (save: () => boolean) => () => void
}

export function connectUpdates(updater: AppUpdater, nativeUpdater: AutoUpdater, notify: (state: UpdateState) => void) {
  let state: UpdateState = null
  let installTimer: ReturnType<typeof setTimeout> | undefined
  updater.autoDownload = false
  updater.autoInstallOnAppQuit = false
  updater.allowDowngrade = false

  const publish = (next: UpdateState) => {
    state = next
    notify(state)
  }
  const fail = (error: unknown) => {
    console.error(new ElectronError([{ path: 'update', message: error instanceof Error ? error.message : String(error) }]))
    clearTimeout(installTimer)
    if (state) publish({ status: 'available', error: 'download' })
  }

  updater.on('error', fail)
  updater.on('update-available', () => publish({ status: 'available' }))
  updater.on('download-progress', ({ percent }) => publish({ status: 'downloading', percent: Math.floor(percent) }))
  updater.on('update-downloaded', () => nativeUpdater.checkForUpdates())
  nativeUpdater.on('update-downloaded', () => {
    installTimer = setTimeout(() => publish({ status: 'available', error: 'save' }), 10_000)
    publish({ status: 'installing' })
  })

  const check = () => {
    if (!state) void updater.checkForUpdates().catch(fail)
  }
  check()
  setInterval(check, 60 * 60 * 1000).unref()

  return {
    getState: () => state,
    download: async () => {
      if (state?.status !== 'available') return
      publish({ status: 'downloading', percent: 0 })
      try {
        await updater.downloadUpdate()
      } catch (error) {
        fail(error)
      }
    },
    install: (saved: boolean) => {
      if (state?.status !== 'installing') return
      clearTimeout(installTimer)
      if (!saved) return publish({ status: 'available', error: 'save' })
      try {
        updater.quitAndInstall()
      } catch (error) {
        fail(error)
      }
    },
  }
}
