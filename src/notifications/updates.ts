import type { Notifications } from '@nesso/plugin'
import type { UpdateBridge } from '../../electron/updates.ts'
import type { translate } from '../i18n/index.ts'

const updateDescriptions = { ready: 'updateReadyDescription', save: 'updateSaveFailure', install: 'updateInstallFailure' } as const

export function connectUpdateNotifications(
  updater: UpdateBridge | undefined,
  notifications: Notifications,
  getTranslation: () => ReturnType<typeof translate>,
) {
  let id: string | undefined
  const dismiss = () => {
    if (id !== undefined) notifications.dismiss(id)
    id = undefined
  }
  const unsubscribe = updater?.subscribe((state) => {
    dismiss()
    if (state?.status !== 'ready') return
    const t = getTranslation()
    id = notifications.notify({
      tone: 'confirmation',
      title: t('updateReady'),
      description: t(updateDescriptions[state.error ?? 'ready']),
      action: { label: t('restartNow'), onClick: () => updater.restart() },
      cancelAction: { label: t('later'), onClick: dismiss },
    })
  })
  return () => {
    unsubscribe?.()
    dismiss()
  }
}
