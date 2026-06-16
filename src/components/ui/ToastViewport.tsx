// SPDX-License-Identifier: MIT
import { useEffect } from 'react'
import { useGraphStore } from '@/store'
import { ActionBanner } from '@/components/banners/ActionBanner'
import type { Toast } from '@/store/types'

const AUTO_DISMISS_MS: Record<Toast['variant'], number> = {
  info: 4500,
  error: 7000,
}

/**
 * Renders the non-blocking toast stack. A toast reuses the `ActionBanner`
 * design and shares the top-right banner column (see `App.tsx`) — the only
 * differences are that it auto-dismisses after a delay and its single action
 * just closes it.
 */
export function ToastViewport() {
  const toasts = useGraphStore((s) => s.toasts)

  return (
    <>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </>
  )
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useGraphStore((s) => s.dismissToast)

  useEffect(() => {
    const timer = window.setTimeout(() => dismissToast(toast.id), AUTO_DISMISS_MS[toast.variant])
    return () => window.clearTimeout(timer)
  }, [toast.id, toast.variant, dismissToast])

  return (
    <ActionBanner
      open
      tone={toast.variant === 'error' ? 'error' : 'default'}
      message={toast.message}
      actions={[]}
      onClose={() => dismissToast(toast.id)}
    />
  )
}
