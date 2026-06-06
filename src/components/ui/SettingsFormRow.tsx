// SPDX-License-Identifier: MIT
import type { ReactNode } from 'react'

interface Props {
  label: string
  description: string
  last?: boolean
  children: ReactNode
}

export function SettingsFormRow({ label, description, last, children }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        paddingBottom: last ? 0 : 18,
        marginBottom: last ? 0 : 18,
        borderBottom: last ? 'none' : '0.5px solid var(--line)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <span style={{ font: "400 13px 'Inter', system-ui", color: 'var(--ink-2)' }}>{label}</span>
        <small
          style={{
            display: 'block',
            font: "400 11px/1.4 'Inter', system-ui",
            color: 'var(--ink-4)',
            marginTop: 3,
          }}
        >
          {description}
        </small>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}
