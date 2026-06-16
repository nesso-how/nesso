// SPDX-License-Identifier: MIT
import type { ReactNode } from 'react'
import { ActionBanner, type ActionBannerAction } from '@/components/banners/ActionBanner'
import { useDesktopUpdater } from '@/hooks/useDesktopUpdater'
import { useT } from '@/i18n'
import { isDesktop } from '@/lib/isDesktop'

export function UpdateBanner() {
  const t = useT()
  const { available, version, status, install, dismiss } = useDesktopUpdater()

  if (!isDesktop() || !available) return null

  let message: ReactNode
  let actions: ActionBannerAction[]
  // The corner X stands in for "Later"/"Dismiss"; install is in progress has no
  // dismiss (you cannot cancel mid-install), so it keeps just the disabled pill.
  let onClose: (() => void) | undefined = dismiss

  switch (status) {
    case 'installing':
      message = version ? t.update.available(version) : null
      actions = [
        {
          label: t.update.installing,
          primary: true,
          disabled: true,
          onClick: () => {},
        },
      ]
      onClose = undefined
      break
    case 'error':
      message = t.update.failed
      actions = [{ label: t.update.retry, primary: true, onClick: () => void install() }]
      break
    case 'restart-required':
      message = t.update.restartRequired
      actions = []
      break
    default:
      message = version ? t.update.available(version) : null
      actions = [{ label: t.update.install, primary: true, onClick: () => void install() }]
  }

  return <ActionBanner open message={message} actions={actions} onClose={onClose} />
}
