// SPDX-License-Identifier: MIT
import { useState } from 'react'

interface Props {
  label: string
  text: string
  color: string
  onClick: () => void
  /** Incoming relations are shown slightly dimmed. */
  dim?: boolean
}

export function EdgeRow({ label, text, color, onClick, dim = false }: Props) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-5)',
        width: '100%',
        textAlign: 'left',
        appearance: 'none',
        border: 0,
        cursor: 'pointer',
        padding: '7px 8px',
        borderRadius: 'var(--radius-md)',
        background: hover ? 'var(--paper-deep)' : 'transparent',
        opacity: dim ? 0.82 : 1,
      }}
    >
      {/* Column so the concept name can wrap on narrow widths instead of
          truncating, with the relation type as a caption beneath it. */}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: 'var(--font-sans)',
            color: 'var(--ink)',
            lineHeight: 1.35,
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          {text}
        </span>
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color,
            lineHeight: 1.2,
          }}
        >
          {label}
        </span>
      </span>
    </button>
  )
}
