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
        alignItems: 'flex-start',
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
          marginTop: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--paper-deep)',
        }}
      >
        <GlyphSVG kind={glyph} color={color} size={13} />
      </span>
      {/* Column so the concept name can wrap on narrow widths instead of
          truncating, with the relation type as a caption beneath it. */}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span
          style={{
            font: "500 13px 'Inter', ui-sans-serif",
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
            font: "11px 'JetBrains Mono', ui-monospace",
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
