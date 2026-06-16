// SPDX-License-Identifier: MIT
import { useState, useEffect, useLayoutEffect, useRef } from 'react'

export function InlineEdit({
  value,
  placeholder,
  onSave,
  textStyle,
  multiline = false,
  maxLength,
  initialEditing = false,
  noEditBorder = false,
  borderedPlaceholder = false,
  onShiftEnter,
  onDeleteEmpty,
}: {
  value: string
  placeholder: string
  onSave: (v: string) => void
  textStyle?: React.CSSProperties
  multiline?: boolean
  maxLength?: number
  initialEditing?: boolean
  noEditBorder?: boolean
  borderedPlaceholder?: boolean
  onShiftEnter?: () => void
  /** Backspace on an empty field removes the row (caller decides when allowed). */
  onDeleteEmpty?: () => void
}) {
  const [editing, setEditing] = useState(initialEditing)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const displayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (!editing) return
    const t = setTimeout(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      try {
        el.setSelectionRange(el.value.length, el.value.length)
      } catch {
        /* setSelectionRange unsupported on some inputs */
      }
    }, 0)
    return () => clearTimeout(t)
  }, [editing])

  useLayoutEffect(() => {
    if (!editing || !multiline) return
    const el = ref.current as HTMLTextAreaElement | null
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [editing, draft, multiline])

  // Snap the display box to the same integer height the textarea computes from
  // scrollHeight, so toggling between display and edit never nudges siblings by
  // the fractional line-height remainder.
  useLayoutEffect(() => {
    if (editing || !multiline) return
    const el = displayRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [editing, value, multiline])

  const commit = () => {
    onSave(draft)
    setEditing(false)
  }
  const cancel = () => {
    setDraft(value)
    setEditing(false)
  }

  const baseStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    appearance: 'none',
    resize: 'none',
    background: 'transparent',
    border: 0,
    outline: 'none',
    padding: 0,
    margin: 0,
    fontFamily: 'inherit',
    ...textStyle,
  }

  const editWrapper: React.CSSProperties = noEditBorder
    ? {}
    : {
        margin: '-4px -6px',
        padding: '4px 6px',
        boxShadow: '0 0 0 1px var(--line)',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-card)',
      }

  if (editing) {
    const editEl = multiline ? (
      <textarea
        ref={ref}
        rows={1}
        value={draft}
        maxLength={maxLength}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          }
          if (e.key === 'Backspace' && draft.length === 0 && onDeleteEmpty) {
            e.preventDefault()
            onDeleteEmpty()
            return
          }
          if (e.key === 'Enter' && e.shiftKey && onShiftEnter) {
            e.preventDefault()
            commit()
            onShiftEnter()
          } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            commit()
          }
        }}
        style={
          {
            ...baseStyle,
            overflow: 'hidden',
            resize: 'none',
            ...(borderedPlaceholder && { padding: '5px 8px' }),
          } as React.CSSProperties
        }
      />
    ) : (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          }
        }}
        style={baseStyle}
      />
    )
    if (noEditBorder) return editEl
    return <div style={editWrapper}>{editEl}</div>
  }

  const empty = !value

  if (empty && borderedPlaceholder) {
    return (
      <div
        onClick={() => setEditing(true)}
        style={{
          border: '0.5px dashed var(--line)',
          borderRadius: 'var(--radius-md)',
          padding: '5px 8px',
          fontSize: '12px',
          fontWeight: 450,
          fontFamily: 'var(--font-sans)',
          color: 'var(--ink-5)',
          cursor: 'default',
          boxSizing: 'border-box',
          width: '100%',
        }}
      >
        {placeholder}
      </div>
    )
  }

  return (
    <div
      ref={displayRef}
      onClick={() => setEditing(true)}
      style={{
        ...textStyle,
        cursor: 'text',
        color: empty ? 'var(--ink-4)' : (textStyle?.color ?? 'var(--ink)'),
        fontStyle: textStyle?.fontStyle ?? 'normal',
        whiteSpace: multiline ? 'pre-wrap' : 'normal',
        wordBreak: 'break-word',
        minHeight: '1.4em',
        ...(borderedPlaceholder && { padding: '5px 8px' }),
      }}
    >
      {empty ? placeholder : value}
    </div>
  )
}
