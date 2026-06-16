// SPDX-License-Identifier: MIT
import { useState, useRef, useEffect } from 'react'

interface Option<T extends string> {
  id: T
  label: string
}

interface Props<T extends string> {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
}

/** Compact dropdown select. Use for growing enums (e.g. Language); use
 *  SegmentedControl for small fixed sets of even choices. */
export function Select<T extends string>({ options, value, onChange }: Props<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current || !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const current = options.find((o) => o.id === value)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          appearance: 'none',
          cursor: 'default',
          border: '0.5px solid var(--line)',
          background: open ? 'var(--paper-deep)' : 'var(--bg-card)',
          color: 'var(--ink-2)',
          font: "500 12px 'Inter', system-ui",
          padding: '5px 7px 5px 11px',
          borderRadius: 6,
        }}
      >
        {current?.label ?? ''}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: 'var(--ink-4)' }}
        >
          <path d="M2.5 4l2.5 2.5L7.5 4" />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            minWidth: '100%',
            background: 'var(--bg-card)',
            border: '0.5px solid var(--line)',
            borderRadius: 8,
            boxShadow: 'var(--shadow-lg)',
            padding: 4,
            zIndex: 5,
            whiteSpace: 'nowrap',
          }}
        >
          {options.map((o) => {
            const active = o.id === value
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id)
                  setOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  textAlign: 'left',
                  appearance: 'none',
                  border: 0,
                  cursor: 'default',
                  background: active ? 'var(--paper-deep)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-2)',
                  font: `${active ? 500 : 400} 12.5px 'Inter', system-ui`,
                  padding: '6px 10px',
                  borderRadius: 5,
                }}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
