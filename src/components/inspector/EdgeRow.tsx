// SPDX-License-Identifier: MIT
import { GlyphSVG } from '@nesso-how/graph'
import type { GlyphKind } from '@/types/graph'

interface Props {
  label: string
  text: string
  color: string
  glyph: GlyphKind
  onClick: () => void
}

export function EdgeRow({ label, text, color, glyph, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '22px 1fr',
        gap: 8,
        alignItems: 'center',
        padding: '5px 4px',
        borderRadius: 5,
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'var(--paper-deep)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      <GlyphSVG kind={glyph} color={color} size={14} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span
          style={{
            font: "500 10px 'JetBrains Mono', ui-monospace",
            color,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {label}
        </span>
        <span
          style={{
            font: "500 13.5px 'Fraunces', serif",
            color: 'var(--ink)',
            letterSpacing: '-0.005em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {text}
        </span>
      </div>
    </div>
  )
}
