// SPDX-License-Identifier: MIT
import { useState } from 'react'
import { GlyphSVG } from '@nesso-how/graph'
import type { GlyphKind } from '@/types/graph'

interface Props {
  label: string
  text: string
  color: string
  glyph: GlyphKind
  onClick: () => void
  /** Incoming relations are shown slightly dimmed. */
  dim?: boolean
}

export function EdgeRow({ label, text, color, glyph, onClick, dim = false }: Props) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        textAlign: 'left',
        appearance: 'none',
        border: 0,
        cursor: 'default',
        padding: '7px 8px',
        borderRadius: 7,
        background: hover ? 'var(--paper-deep)' : 'transparent',
        opacity: dim ? 0.82 : 1,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--paper-deep)',
        }}
      >
        <GlyphSVG kind={glyph} color={color} size={13} />
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          font: "500 13px 'Inter', ui-sans-serif",
          color: 'var(--ink)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {text}
      </span>
      <span
        style={{
          font: "11px 'JetBrains Mono', ui-monospace",
          color,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
    </button>
  )
}
