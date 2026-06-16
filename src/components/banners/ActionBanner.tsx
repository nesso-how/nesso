// SPDX-License-Identifier: MIT
import type { CSSProperties, ReactNode } from 'react'
import { CloseButton } from '@/components/ui/CloseButton'

export interface ActionBannerAction {
  label: string
  onClick: () => void
  /** Filled pill (default action). */
  primary?: boolean
  disabled?: boolean
}

export interface ActionBannerProps {
  /** When false, renders nothing. */
  open: boolean
  message: ReactNode
  actions: ActionBannerAction[]
  /** `error` tints the border with the accent; `default` is neutral. */
  tone?: 'default' | 'error'
  /** When set, shows a corner X (like dialog headers) instead of an action button — used by auto-dismiss toasts. */
  onClose?: () => void
}

function actionBannerButtonStyle(primary: boolean, disabled = false): CSSProperties {
  return {
    appearance: 'none',
    border: `0.5px solid ${primary ? 'var(--ink-2)' : 'var(--line)'}`,
    background: primary ? 'var(--ink-2)' : 'transparent',
    color: primary ? 'var(--paper)' : 'var(--ink-2)',
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    padding: '8px 16px',
    borderRadius: 'var(--radius-md)',
    cursor: disabled ? 'not-allowed' : 'default',
    opacity: disabled ? 0.55 : 1,
    whiteSpace: 'nowrap',
    width: '100%',
    textAlign: 'center',
  }
}

export function ActionBanner({
  open,
  message,
  actions,
  tone = 'default',
  onClose,
}: ActionBannerProps) {
  if (!open || (actions.length === 0 && !onClose)) return null

  return (
    <div
      role="alert"
      className="nx-action-banner"
      style={{
        // Positioning is owned by the stacking container in App.tsx so multiple
        // banners (file conflict + update) stack instead of overlapping.
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        padding: '16px 18px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-card)',
        border: `0.5px solid ${tone === 'error' ? 'var(--accent)' : 'var(--line)'}`,
        boxShadow: 'var(--shadow-lg)',
        width: 240,
      }}
    >
      {onClose && (
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <CloseButton onClick={onClose} />
        </div>
      )}
      <span
        style={{
          fontSize: '13px',
          fontWeight: 400,
          lineHeight: 1.5,
          fontFamily: 'var(--font-sans)',
          color: 'var(--ink-2)',
          paddingRight: onClose ? 20 : 0,
        }}
      >
        {message}
      </span>
      {actions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={action.disabled}
              onClick={() => void action.onClick()}
              style={actionBannerButtonStyle(action.primary ?? false, action.disabled)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
