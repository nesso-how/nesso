// SPDX-License-Identifier: MIT
import { useState, type CSSProperties } from 'react'

interface Props {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}

export function Stepper({ value, min, max, onChange }: Props) {
  // Local draft so the field can be cleared while retyping — committing the
  // raw input on every keystroke used to snap an empty field to `min`.
  const [draft, setDraft] = useState<string | null>(null)
  const btnStyle: CSSProperties = {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--ink-3)',
    fontSize: '14px',
    fontWeight: 400,
    fontFamily: 'var(--font-sans)',
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
        borderRadius: 'var(--radius-sm)',
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
        value={draft ?? String(value)}
        min={min}
        max={max}
        onChange={(e) => {
          const raw = e.target.value
          setDraft(raw)
          const n = Math.floor(Number(raw))
          if (raw !== '' && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
        }}
        onBlur={() => setDraft(null)}
        style={{
          width: 44,
          border: 'none',
          borderLeft: '0.5px solid var(--line)',
          borderRight: '0.5px solid var(--line)',
          background: 'transparent',
          color: 'var(--ink)',
          fontSize: '12px',
          fontWeight: 500,
          fontFamily: 'var(--font-mono)',
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
