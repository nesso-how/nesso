import { CancellationToken } from 'builder-util-runtime'
import type { AppUpdater } from 'electron-updater'
import type { AutoUpdater } from 'electron'
import { gt } from 'semver'
import { ElectronError } from './errors.ts'

export type UpdateState = {
  status: 'downloading' | 'ready' | 'saving' | 'installing'
  version: string
  error?: 'download' | 'save' | 'install'
} | null

export type UpdateBridge = {
  subscribe: (listener: (state: UpdateState) => void) => () => void
  restart: () => void
  startupComplete: () => void
  beforeInstall: (save: () => Promise<boolean>, confirm: () => Promise<boolean>) => () => void
}

export const INSTALL_FEEDBACK_MS = 1_000
export const INSTALL_TIMEOUT_MS = 30_000
export const CONFIRM_TIMEOUT_MS = 10 * 60 * 1000
export const STARTUP_CHECK_FALLBACK_MS = 60_000

export function connectUpdates(
  updater: AppUpdater,
  nativeUpdater: AutoUpdater | undefined,
  notify: (state: UpdateState) => void,
  installOnQuit = false,
) {
  let state: UpdateState = null
  let checking = false
  let download: CancellationToken | undefined
  let progress = false
  let installTimer: ReturnType<typeof setTimeout> | undefined
  updater.autoDownload = false
  updater.autoInstallOnAppQuit = installOnQuit
  updater.allowDowngrade = false

  const publish = (next: UpdateState) => {
    state = next
    notify(state)
  }
  const idle = () => !state || state.status === 'ready' || state.error === 'download'
  const fail = (error: unknown) => {
    console.error(
      new ElectronError([
        { path: 'update', message: error instanceof Error ? error.message : String(error) },
      ]),
    )
    clearTimeout(installTimer)
    if (state?.status === 'saving' || state?.status === 'installing')
      publish({ ...state, status: 'ready', error: 'install' })
    else if (state?.status === 'downloading') publish({ ...state, error: 'download' })
  }
  const expire = (version: string, ms: number) => {
    clearTimeout(installTimer)
    installTimer = setTimeout(() => publish({ status: 'ready', version, error: 'save' }), ms)
  }

  updater.on('error', fail)
  updater.on('update-available', ({ version }) => {
    if (!idle() || download) return
    if (state?.status === 'ready' && !gt(version, state.version)) return
    const token = new CancellationToken()
    download = token
    progress = true
    publish({ status: 'downloading', version })
    void updater
      .downloadUpdate(token)
      .catch((error) => {
        if (!token.cancelled) fail(error)
      })
      .finally(() => {
        download = undefined
      })
  })
  updater.on('download-progress', () => {
    progress = true
  })
  updater.on('update-downloaded', () => {
    if (state?.status !== 'downloading' || state.error) return
    if (!nativeUpdater) return publish({ status: 'ready', version: state.version })
    try {
      nativeUpdater.checkForUpdates()
    } catch (error) {
      fail(error)
    }
  })
  nativeUpdater?.on('update-downloaded', () => {
    if (state?.status === 'downloading' && !state.error)
      publish({ status: 'ready', version: state.version })
  })

  const check = async () => {
    if (!idle() || checking || download) return
    checking = true
    try {
      await updater.checkForUpdates()
    } catch (error) {
      fail(error)
    } finally {
      checking = false
    }
  }
  let started = false
  const start = () => {
    clearTimeout(fallback)
    if (started) return
    started = true
    void check()
  }
  const fallback = setTimeout(start, STARTUP_CHECK_FALLBACK_MS)
  setInterval(
    () => {
      if (state?.status === 'downloading' && !state.error && !progress) {
        download?.cancel()
        fail(new ElectronError([{ path: 'update', message: 'Update download stalled' }]))
      }
      progress = false
      void check()
    },
    60 * 60 * 1000,
  ).unref()

  return {
    getState: () => state,
    start,
    restart: () => {
      if (state?.status !== 'ready') return
      const { version } = state
      expire(version, 10_000)
      publish({ status: 'saving', version })
    },
    confirming: () => {
      if (state?.status === 'saving') expire(state.version, CONFIRM_TIMEOUT_MS)
    },
    install: (saved: boolean) => {
      if (state?.status !== 'saving') return
      clearTimeout(installTimer)
      if (!saved) return publish({ ...state, status: 'ready', error: 'save' })
      publish({ ...state, status: 'installing' })
      installTimer = setTimeout(() => {
        try {
          updater.quitAndInstall()
        } catch (error) {
          return fail(error)
        }
        if (state?.status === 'installing')
          installTimer = setTimeout(
            () => fail(new ElectronError([{ path: 'update', message: 'Update did not restart' }])),
            INSTALL_TIMEOUT_MS,
          )
      }, INSTALL_FEEDBACK_MS)
    },
  }
}
