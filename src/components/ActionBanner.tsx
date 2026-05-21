// SPDX-License-Identifier: MIT
import type { CSSProperties, ReactNode } from 'react'

export interface ActionBannerAction {
  label: string
  onClick: () => void
  /** Filled pill (default action). */
  primary?: boolean
}

export interface ActionBannerProps {
  /** When false, renders nothing. */
  open: boolean
  message: ReactNode
  actions: ActionBannerAction[]
}

export function actionBannerButtonStyle(primary: boolean): CSSProperties {
  return {
    appearance: 'none',
    border: `0.5px solid ${primary ? 'var(--ink-2)' : 'var(--line)'}`,
    background: primary ? 'var(--ink-2)' : 'transparent',
    color: primary ? 'var(--paper)' : 'var(--ink-3)',
    font: "500 11px 'JetBrains Mono', ui-monospace",
    letterSpacing: '0.04em',
    padding: '6px 14px',
    borderRadius: 999,
    cursor: 'default',
    whiteSpace: 'nowrap',
    width: '100%',
    textAlign: 'center',
  }
}

export function ActionBanner({
  open,
  message,
  actions,
}: ActionBannerProps) {
  if (!open || actions.length === 0) return null

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 60,
        right: 16,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '16px 18px',
        borderRadius: 10,
        background: 'color-mix(in srgb, var(--bg-elev) 72%, transparent)',
        border: '0.5px solid var(--ink-3)',
        backdropFilter: 'blur(16px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        width: 220,
        animation: 'banner-in 140ms ease',
      }}
    >
      <span
        style={{
          font: "400 13px/1.4 'Inter', system-ui",
          color: 'var(--ink-2)',
        }}
      >
        {message}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => void action.onClick()}
            style={actionBannerButtonStyle(action.primary ?? false)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
