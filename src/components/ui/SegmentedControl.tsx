// SPDX-License-Identifier: MIT
import type { CSSProperties } from 'react'

interface Option {
  id: string
  label: string
}

interface Props {
  options: Option[]
  value: string
  onChange: (id: string) => void
  style?: CSSProperties
}

export function SegmentedControl({ options, value, onChange, style }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--paper-deep)',
        borderRadius: 6,
        padding: 2,
        ...style,
      }}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          style={{
            appearance: 'none',
            border: 0,
            background: o.id === value ? 'var(--bg-card)' : 'transparent',
            color: o.id === value ? 'var(--ink)' : 'var(--ink-4)',
            font:
              o.id === value ? "500 11px 'Inter', ui-sans-serif" : "11px 'Inter', ui-sans-serif",
            padding: '3px 9px',
            borderRadius: 4,
            cursor: 'default',
            boxShadow: o.id === value ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
