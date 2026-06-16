// SPDX-License-Identifier: MIT
import { useGraphStore } from '@/store'
import { ModalOverlay } from '@/components/ui/ModalOverlay'
import { settleConfirm } from '@/components/ui/confirm'

const buttonBase = {
  appearance: 'none' as const,
  font: "500 13px 'Inter', system-ui",
  padding: '8px 16px',
  borderRadius: 7,
  cursor: 'default' as const,
}

/** Blocking confirmation dialog for destructive actions. Mounted once at the app shell. */
export function ConfirmDialog() {
  const request = useGraphStore((s) => s.confirmRequest)
  const danger = request?.tone === 'danger'
  const accent = danger ? 'var(--accent)' : 'var(--ink-2)'

  return (
    <ModalOverlay open={!!request} onClose={() => settleConfirm(false)}>
      {request && (
        <div
          style={{
            width: 'min(360px, calc(100vw - 48px))',
            background: 'var(--bg-card)',
            border: '0.5px solid var(--line)',
            borderRadius: 14,
            boxShadow: 'var(--shadow-lg)',
            padding: 22,
          }}
        >
          <h2 style={{ margin: 0, font: "600 15px 'Inter', system-ui", color: 'var(--ink)' }}>
            {request.title}
          </h2>
          <p
            style={{
              margin: '8px 0 20px',
              font: "400 13px/1.5 'Inter', system-ui",
              color: 'var(--ink-2)',
            }}
          >
            {request.message}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              autoFocus
              onClick={() => settleConfirm(false)}
              style={{
                ...buttonBase,
                border: '0.5px solid var(--line)',
                background: 'transparent',
                color: 'var(--ink-2)',
              }}
            >
              {request.cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => settleConfirm(true)}
              style={{
                ...buttonBase,
                border: `0.5px solid ${accent}`,
                background: accent,
                color: 'var(--paper)',
              }}
            >
              {request.confirmLabel}
            </button>
          </div>
        </div>
      )}
    </ModalOverlay>
  )
}
