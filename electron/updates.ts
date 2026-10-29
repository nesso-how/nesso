import type { AppUpdater } from 'electron-updater'
import type { AutoUpdater } from 'electron'
import { ElectronError } from './errors.ts'

export type UpdateState = {
  status: 'downloading' | 'ready' | 'saving' | 'installing'
  version: string
  error?: 'save' | 'install'
} | null

export type UpdateBridge = {
  subscribe: (listener: (state: UpdateState) => void) => () => void
  restart: () => void
  beforeInstall: (save: () => Promise<boolean>) => () => void
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
    if (state?.status === 'saving' || state?.status === 'installing') publish({ ...state, status: 'ready', error: 'install' })
    else if (state?.status !== 'ready') publish(null)
  }

  updater.on('error', fail)
  updater.on('update-available', ({ version }) => {
    if (state) return
    publish({ status: 'downloading', version })
    void updater.downloadUpdate().catch(fail)
  })
  updater.on('update-downloaded', () => {
    if (state?.status !== 'downloading') return
    if (!nativeUpdater) return publish({ ...state, status: 'ready' })
    try {
      nativeUpdater.checkForUpdates()
    } catch (error) {
      fail(error)
    }
  })
  nativeUpdater?.on('update-downloaded', () => {
    if (state?.status === 'downloading') publish({ ...state, status: 'ready' })
  })

  const check = async () => {
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
      const { version } = state
      installTimer = setTimeout(() => publish({ status: 'ready', version, error: 'save' }), 10_000)
      publish({ status: 'saving', version })
    },
    install: (saved: boolean) => {
      if (state?.status !== 'saving') return
      clearTimeout(installTimer)
      if (!saved) return publish({ ...state, status: 'ready', error: 'save' })
      publish({ ...state, status: 'installing' })
      try {
        updater.quitAndInstall()
      } catch (error) {
        fail(error)
      }
    },
  }
}
