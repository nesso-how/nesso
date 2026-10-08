import { useCallback, useState, type ReactNode } from 'react'
import { ToastViewport as Viewport, type ToastItem } from '@nesso/ui'
import { useTranslation } from '@/i18n'
import { ToastsContext, useToasts, type ToastDraft } from './toastQueue'

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
  return (
    <Viewport
      items={items}
      label={t('toasts')}
      closeLabel={t('close')}
      queueLabel={t('toastQueued', { count: Math.max(0, items.length - 3) })}
      onDismiss={dismiss}
      onRestoreFocus={() => (document.activeElement as HTMLElement | null)?.blur?.()}
    />
  )
}
