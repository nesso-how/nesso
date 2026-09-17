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
 *  SegmentedControl for small fixed sets of even choices. The menu spans the
 *  control width, scrolls internally past a max height, and flips above the
 *  toggle when there is no room below — it must survive inside scrollable
 *  dialog content without being clipped. */
export function Select<T extends string>({ options, value, onChange }: Props<T>) {
  const [open, setOpen] = useState(false)
  const [openAbove, setOpenAbove] = useState(false)
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

  const toggle = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      // Measure against the enclosing dialog when there is one: the menu
      // must fit the dialog's visible box, not just the viewport, because
      // dialogs clip overflowing content.
      const host = ref.current.closest('[role="dialog"]')
      const top = host ? host.getBoundingClientRect().top : 0
      const bottom = host ? host.getBoundingClientRect().bottom : window.innerHeight
      const spaceBelow = bottom - rect.bottom
      // Estimated menu height for the current option count, capped the same
      // way as the menu style below. Prefer below; flip above only when the
      // menu would not fit and above has meaningfully more room.
      const need = Math.min(options.length * 33 + 16, 244)
      setOpenAbove(spaceBelow < need && rect.top - top > spaceBelow)
    }
    setOpen((o) => !o)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        title={current?.label ?? ''}
        onClick={toggle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          appearance: 'none',
          cursor: 'pointer',
          border: '0.5px solid var(--line)',
          background: open ? 'var(--paper-deep)' : 'var(--bg-card)',
          color: 'var(--ink-2)',
          fontSize: '12px',
          fontWeight: 500,
          fontFamily: 'var(--font-sans)',
          padding: '5px 7px 5px 11px',
          borderRadius: 'var(--radius-sm)',
          maxWidth: '100%',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{current?.label ?? ''}</span>
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
          className="nesso-scrollbar"
          style={{
            position: 'absolute',
            ...(openAbove ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }),
            left: 0,
            right: 0,
            maxHeight: 240,
            overflowY: 'auto',
            background: 'var(--bg-card)',
            border: '0.5px solid var(--line)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: 'var(--space-2)',
            zIndex: 5,
          }}
        >
          {options.map((o) => {
            const active = o.id === value
            return (
              <button
                key={o.id}
                type="button"
                title={o.label}
                onClick={() => {
                  onChange(o.id)
                  setOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  minWidth: 0,
                  textAlign: 'left',
                  appearance: 'none',
                  border: 0,
                  cursor: 'pointer',
                  background: active ? 'var(--paper-deep)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-2)',
                  font: `${active ? 500 : 400} 12.5px 'Inter', system-ui`,
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
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
