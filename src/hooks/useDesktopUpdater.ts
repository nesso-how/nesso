// SPDX-License-Identifier: MIT
import { useEffect, useRef, useState } from 'react'
import type { Update } from '@tauri-apps/plugin-updater'
import { isDesktop } from '@/lib/isDesktop'

export type UpdateStatus =
  | 'idle'
  | 'available'
  | 'installing'
  /** Update was applied on disk but the automatic relaunch failed. */
  | 'restart-required'
  /** Download or install failed; the user can retry. */
  | 'error'

export interface DesktopUpdater {
  /** True whenever the banner should be shown (any non-idle status). */
  available: boolean
  /** Version string of the pending update, if any. */
  version: string | null
  status: UpdateStatus
  /** Download + install the pending update, then relaunch the app. */
  install: () => Promise<void>
  /** Hide the banner for the rest of this session. */
  dismiss: () => void
}

/**
 * Checks GitHub Releases for a newer build once on mount (desktop only) and
 * exposes a one-shot installer. Network/endpoint failures are swallowed so the
 * web build and offline launches stay silent — no banner unless an update is
 * actually available (failures are logged in dev for debugging). Plugin modules
 * are imported dynamically so the web bundle never pulls them in.
 */
export function useDesktopUpdater(): DesktopUpdater {
  const [version, setVersion] = useState<string | null>(null)
  const [status, setStatus] = useState<UpdateStatus>('idle')
  // The Update handle from check(), kept so install() can act on it later.
  const updateRef = useRef<Update | null>(null)
  // Synchronous re-entrancy guard: state updates are async, so a double click
  // in the same tick could otherwise call install() twice.
  const installingRef = useRef(false)

  useEffect(() => {
    if (!isDesktop()) return
    let cancelled = false
    void (async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater')
        const update = await check()
        if (cancelled || !update) return
        updateRef.current = update
        setVersion(update.version)
        setStatus('available')
      } catch (err) {
        // Offline or unreachable endpoint: stay silent, no banner.
        if (import.meta.env.DEV) console.warn('[updater] check failed:', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const install = async () => {
    if (installingRef.current) return
    const update = updateRef.current
    if (!update) return
    installingRef.current = true
    setStatus('installing')
    try {
      await update.downloadAndInstall()
    } catch (err) {
      // Nothing was applied: let the user retry from the 'available' actions.
      if (import.meta.env.DEV) console.warn('[updater] download/install failed:', err)
      installingRef.current = false
      setStatus('error')
      return
    }
    // The update is now applied on disk; only the relaunch can still fail.
    try {
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[updater] relaunch failed:', err)
      installingRef.current = false
      setStatus('restart-required')
    }
  }

  const dismiss = () => {
    installingRef.current = false
    setStatus('idle')
  }

  return { available: status !== 'idle', version, status, install, dismiss }
}
