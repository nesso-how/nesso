// SPDX-License-Identifier: MIT
import type { ReactNode } from 'react'

interface Props {
  label: string
  /** Optional helper text under the label. Omit for label-only rows. */
  description?: string
  last?: boolean
  /** Set false inside a grouped block where the parent supplies spacing via gap. */
  divider?: boolean
  children: ReactNode
}

export function SettingsFormRow({ label, description, last, divider = true, children }: Props) {
  const showDivider = divider && !last
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-7)',
        paddingBottom: showDivider ? 18 : 0,
        marginBottom: showDivider ? 18 : 0,
        borderBottom: showDivider ? '0.5px solid var(--line)' : 'none',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 400,
            fontFamily: 'var(--font-sans)',
            color: 'var(--ink-2)',
          }}
        >
          {label}
        </span>
        {description && (
          <small
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 400,
              lineHeight: 1.4,
              fontFamily: 'var(--font-sans)',
              color: 'var(--ink-4)',
              marginTop: 3,
            }}
          >
            {description}
          </small>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}
