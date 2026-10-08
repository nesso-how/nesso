import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ToastViewport as Viewport, type ToastItem } from '@nesso/ui'
import { useTranslation } from '@/i18n'
import { ToastsContext, useToasts, type ToastDraft } from './toastQueue'
import type { UpdateState } from '../../../electron/updates'

const updateDescriptions = { ready: 'updateReadyDescription', save: 'updateSaveFailure', install: 'updateInstallFailure' } as const

export function ToastsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const notify = useCallback((item: ToastDraft) => {
    setItems((current) => [...current, { ...item, id: crypto.randomUUID() }])
  }, [])
  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])
  return <ToastsContext.Provider value={{ items, notify, dismiss }}>{children}</ToastsContext.Provider>
}

export function ToastsHost() {
  const t = useTranslation()
  const { items, dismiss } = useToasts()
  const [update, setUpdate] = useState<UpdateState>(null)
  useEffect(() => window.nessoUpdater?.subscribe(setUpdate), [])
  const updateToast: ToastItem[] = update?.status === 'ready' ? [{
    id: `update:${update.error ?? 'ready'}`,
    tone: 'request',
    label: t('update'),
    title: t('updateReady'),
    description: t(updateDescriptions[update.error ?? 'ready']),
    action: { label: t('restartNow'), onClick: () => window.nessoUpdater?.restart() },
    cancelAction: { label: t('later'), onClick: () => setUpdate(null) },
  }] : []
  const visibleItems = [...updateToast, ...items]
  return (
    <Viewport
      items={visibleItems}
      label={t('toasts')}
      closeLabel={t('close')}
      queueLabel={t('toastQueued', { count: Math.max(0, visibleItems.length - 3) })}
      onDismiss={(id) => {
        if (id.startsWith('update:')) setUpdate(null)
        else dismiss(id)
      }}
      onRestoreFocus={() => (document.activeElement as HTMLElement | null)?.blur?.()}
    />
  )
}
