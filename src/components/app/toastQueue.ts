import { createContext, useContext } from 'react'
import type { ToastItem } from '@nesso/ui'

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

export type ToastDraft = DistributiveOmit<ToastItem, 'id'>

export const ToastsContext = createContext<{
  items: ToastItem[]
  notify: (item: ToastDraft) => void
  dismiss: (id: string) => void
} | null>(null)

export function useToasts() {
  const context = useContext(ToastsContext)
  if (!context) throw new Error('useToasts must be used within ToastsProvider')
  return context
}

export function viewExportedToast(t: (key: 'info' | 'viewExported' | 'viewExportedDescription') => string): ToastDraft {
  return { tone: 'info', label: t('info'), title: t('viewExported'), description: t('viewExportedDescription') }
}
