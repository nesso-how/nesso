import { useSyncExternalStore } from 'react'
import { ToastViewport as Viewport } from '@nesso/ui'
import { useTranslation } from '@/i18n'
import { notifications } from '@/notifications'

export function ToastsHost() {
  const t = useTranslation()
  const items = useSyncExternalStore(notifications.subscribe, notifications.getSnapshot)
  return (
    <Viewport
      items={items.map((item) => ({ ...item, label: t(item.tone) }))}
      label={t('toasts')}
      closeLabel={t('close')}
      queueLabel={t('toastQueued', { count: Math.max(0, items.length - 3) })}
      onDismiss={notifications.api.dismiss}
      onRestoreFocus={() => (document.activeElement as HTMLElement | null)?.blur?.()}
    />
  )
}
