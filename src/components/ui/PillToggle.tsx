// SPDX-License-Identifier: MIT
import type { CSSProperties } from 'react'

interface Option<T extends string> {
  id: T
  label: string
  title?: string
}

interface Props<T extends string> {
  options: Option<T>[]
  value: T
  onChange: (id: T) => void
  tone?: 'solid' | 'soft'
  style?: CSSProperties
}

export function PillToggle<T extends string>({
  options,
  value,
  onChange,
  tone = 'solid',
  style,
}: Props<T>) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', ...style }}>
      {options.map((opt) => {
        const active = value === opt.id
        const activeBorder = 'var(--ink-2)'
        const activeBg = tone === 'soft' ? 'var(--paper-deep)' : 'var(--ink-2)'
        const activeColor = tone === 'soft' ? 'var(--ink)' : 'var(--paper)'
        return (
          <button
            key={opt.id}
            type="button"
            title={opt.title}
            onClick={() => onChange(opt.id)}
            style={{
              appearance: 'none',
              border: `0.5px solid ${active ? activeBorder : 'var(--line)'}`,
              background: active ? activeBg : 'transparent',
              color: active ? activeColor : 'var(--ink-3)',
              font: "500 11px 'JetBrains Mono', ui-monospace",
              letterSpacing: '0.04em',
              padding: tone === 'soft' ? '5px 10px' : '5px 12px',
              borderRadius: 999,
              cursor: 'default',
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
