// SPDX-License-Identifier: MIT
import { useGraphStore } from '@/store'
import { ModalOverlay } from '@/components/ui/ModalOverlay'
import { settleConfirm } from '@/components/ui/confirm'

const buttonBase = {
  appearance: 'none' as const,
  fontSize: '13px',
  fontWeight: 500,
  fontFamily: 'var(--font-sans)',
  padding: '8px 16px',
  borderRadius: 'var(--radius-md)',
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
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            padding: 22,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              color: 'var(--ink)',
            }}
          >
            {request.title}
          </h2>
          <p
            style={{
              margin: '8px 0 20px',
              fontSize: '13px',
              fontWeight: 400,
              lineHeight: 1.5,
              fontFamily: 'var(--font-sans)',
              color: 'var(--ink-2)',
            }}
          >
            {request.message}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-4)' }}>
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
