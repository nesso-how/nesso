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
      break
    case 'error':
      message = t.update.failed
      actions = [
        { label: t.update.retry, primary: true, onClick: () => void install() },
        { label: t.update.later, onClick: dismiss },
      ]
      break
    case 'restart-required':
      message = t.update.restartRequired
      actions = [{ label: t.update.dismiss, primary: true, onClick: dismiss }]
      break
    default:
      message = version ? t.update.available(version) : null
      actions = [
        { label: t.update.install, primary: true, onClick: () => void install() },
        { label: t.update.later, onClick: dismiss },
      ]
  }

  return <ActionBanner open message={message} actions={actions} />
}
