// SPDX-License-Identifier: AGPL-3.0
import { EDGE_CATEGORIES, EDGE_TYPES } from '@/data/edgeTypes'
import { GlyphSVG } from './GlyphSVG'
import { useGraphStore } from '@/store/graph'
import type { EdgeTypeName } from '@/types/graph'

interface Props {
  open: boolean
  onClose: () => void
}

export function EdgeLegend({ open, onClose }: Props) {
  const { settings } = useGraphStore()
  const encoding = settings.edgeEncoding

  const groups = Object.entries(EDGE_CATEGORIES).map(([k, c]) => ({
    key: k,
    ...c,
    types: Object.entries(EDGE_TYPES).filter(([, t]) => t.cat === k) as [EdgeTypeName, (typeof EDGE_TYPES)[EdgeTypeName]][],
  }))

  return (
    <div style={{
      position: 'absolute',
      left: 18,
      top: 80,
      bottom: 80,
      width: 286,
      zIndex: 25,
      background: 'var(--bg-elev)',
      border: '0.5px solid var(--line)',
      borderRadius: 14,
      padding: '14px 0 6px',
      boxShadow: 'var(--shadow-md)',
      display: 'flex',
      flexDirection: 'column',
      transform: open ? 'none' : 'translateX(calc(-100% - 36px))',
      opacity: open ? 1 : 0,
      pointerEvents: open ? 'auto' : 'none',
      transition: 'transform 0.3s cubic-bezier(.5,.2,.2,1), opacity 0.3s',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px 10px',
        borderBottom: '0.5px solid var(--line)',
        marginBottom: 6,
      }}>
        <h3 style={{ margin: 0, font: "500 13px 'Fraunces', ui-serif, serif", letterSpacing: '-0.005em' }}>
          Relation types
        </h3>
        <small style={{ color: 'var(--ink-4)', fontSize: 11 }}>
          {Object.keys(EDGE_TYPES).length} kinds
        </small>
      </div>

      {/* Body */}
      <div style={{
        overflowY: 'auto',
        padding: '4px 8px 8px',
        flex: 1,
        scrollbarWidth: 'thin',
      }}>
        {groups.map(g => (
          <div key={g.key} style={{ padding: '8px 6px 4px' }}>
            {/* Category header */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 4px 6px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: g.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{
                font: "600 10.5px 'JetBrains Mono', ui-monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: g.color,
              }}>
                {g.label}
              </span>
              <small style={{ color: 'var(--ink-4)', fontSize: 10.5, fontStyle: 'italic', fontFamily: 'Fraunces, serif' }}>
                {g.subtitle}
              </small>
            </div>

            {g.types.map(([id, t]) => (
              <div key={id} style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr auto',
                gap: 8,
                alignItems: 'center',
                padding: '6px 4px',
                borderRadius: 6,
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--paper-deep)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {/* Mini edge preview */}
                <svg width="36" height="14" viewBox="0 0 36 14">
                  <path
                    d="M2 7 Q 18 7 34 7"
                    fill="none"
                    stroke={encoding === 'minimal' ? 'var(--ink-3)' : g.color}
                    strokeWidth={1.4}
                    strokeLinecap="round"
                    strokeDasharray={
                      t.line === 'dashed' ? '6 5' :
                      t.line === 'dotted' ? '0.1 5' :
                      t.line === 'wavy'   ? '1 4' : '0'
                    }
                  />
                  <circle cx="18" cy="7" r="6.5"
                    fill="var(--bg-elev)"
                    stroke={encoding === 'minimal' ? 'var(--ink-3)' : g.color}
                    strokeWidth={0.8}
                  />
                  <g transform="translate(11, 0)">
                    <GlyphSVG kind={t.glyph} color={encoding === 'minimal' ? 'var(--ink-3)' : g.color} size={14} />
                  </g>
                </svg>

                <span style={{
                  font: "500 12px 'JetBrains Mono', ui-monospace",
                  color: encoding === 'minimal' ? 'var(--ink-2)' : g.color,
                }}>
                  {t.label}
                </span>

                {t.symmetric && (
                  <span style={{ color: 'var(--ink-4)', fontSize: 10, fontFamily: 'Fraunces, serif', fontStyle: 'italic' }}>
                    symmetric
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
