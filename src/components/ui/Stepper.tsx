// SPDX-License-Identifier: MIT
import type { CSSProperties } from 'react'

interface Props {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}

export function Stepper({ value, min, max, onChange }: Props) {
  const btnStyle: CSSProperties = {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--ink-3)',
    font: "400 14px 'Inter', system-ui",
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'default',
    flexShrink: 0,
    lineHeight: 1,
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        border: '0.5px solid var(--line)',
        borderRadius: 6,
        background: 'var(--paper-deep)',
        overflow: 'hidden',
      }}
    >
      <button type="button" style={btnStyle} onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <input
        type="number"
        className="settings-stepper"
        value={value}
        min={min}
        max={max}
        onChange={(e) =>
          onChange(Math.min(max, Math.max(min, Math.floor(Number(e.target.value)) || 0)))
        }
        style={{
          width: 44,
          border: 'none',
          borderLeft: '0.5px solid var(--line)',
          borderRight: '0.5px solid var(--line)',
          background: 'transparent',
          color: 'var(--ink)',
          font: "500 12px 'JetBrains Mono', ui-monospace",
          textAlign: 'center',
          padding: '3px 0',
          outline: 'none',
        }}
      />
      <button type="button" style={btnStyle} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </div>
  )
}
