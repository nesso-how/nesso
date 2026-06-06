// SPDX-License-Identifier: MIT
import type { ReactNode } from 'react'

interface Props {
  label: string
  children: ReactNode
}

export function SettingRow({ label, children }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '5px 0',
        gap: 12,
      }}
    >
      <span style={{ font: "12px 'Inter', ui-sans-serif", color: 'var(--ink-3)' }}>{label}</span>
      {children}
    </div>
  )
}
