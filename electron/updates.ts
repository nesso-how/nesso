import type { AppUpdater } from 'electron-updater'
import type { AutoUpdater } from 'electron'
import { ElectronError } from './errors.ts'

export type UpdateState = {
  status: 'downloading' | 'ready' | 'installing'
  error?: 'save' | 'install'
} | null

export type UpdateBridge = {
  subscribe: (listener: (state: UpdateState) => void) => () => void
  restart: () => void
  beforeInstall: (save: () => boolean) => () => void
}

export function connectUpdates(updater: AppUpdater, nativeUpdater: AutoUpdater | undefined, notify: (state: UpdateState) => void) {
  let state: UpdateState = null
  let checking = false
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
    if (state?.status === 'installing') publish({ status: 'ready', error: 'install' })
    else if (state?.status !== 'ready') publish(null)
  }

  updater.on('error', fail)
  updater.on('update-available', () => {
    if (state) return
    publish({ status: 'downloading' })
    void updater.downloadUpdate().catch(fail)
  })
  updater.on('update-downloaded', () => {
    if (state?.status !== 'downloading') return
    if (!nativeUpdater) return publish({ status: 'ready' })
    try {
      nativeUpdater.checkForUpdates()
    } catch (error) {
      fail(error)
    }
  })
  nativeUpdater?.on('update-downloaded', () => {
    if (state?.status === 'downloading') publish({ status: 'ready' })
  })

  const check = async () => {
    if (state?.status === 'ready') return publish({ ...state })
    if (state || checking) return
    checking = true
    try {
      await updater.checkForUpdates()
    } catch (error) {
      fail(error)
    } finally {
      checking = false
    }
  }
  void check()
  setInterval(() => { void check() }, 60 * 60 * 1000).unref()

  return {
    getState: () => state,
    restart: () => {
      if (state?.status !== 'ready') return
      installTimer = setTimeout(() => publish({ status: 'ready', error: 'save' }), 10_000)
      publish({ status: 'installing' })
    },
    install: (saved: boolean) => {
      if (state?.status !== 'installing') return
      clearTimeout(installTimer)
      if (!saved) return publish({ status: 'ready', error: 'save' })
      try {
        updater.quitAndInstall()
      } catch (error) {
        fail(error)
      }
    },
  }
}
