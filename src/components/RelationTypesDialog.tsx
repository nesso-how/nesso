// SPDX-License-Identifier: MIT
import { EDGE_CATEGORIES, EDGE_TYPES } from '@/data/edgeTypes'
import { GlyphSVG } from './GlyphSVG'
import { useGraphStore } from '@/store/graph'
import type { EdgeTypeName } from '@/types/graph'

interface Props {
  open: boolean
  onClose: () => void
}

export function RelationTypesDialog({ open, onClose }: Props) {
  const { settings } = useGraphStore()
  const encoding = settings.edgeEncoding

  if (!open) return null

  const groups = Object.entries(EDGE_CATEGORIES).map(([k, c]) => ({
    key: k,
    ...c,
    types: Object.entries(EDGE_TYPES).filter(([, t]) => t.cat === k) as [EdgeTypeName, (typeof EDGE_TYPES)[EdgeTypeName]][],
  }))

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 75,
        background: 'rgba(20, 18, 14, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: '92vw',
          maxHeight: '76vh',
          background: 'var(--bg-card)',
          border: '0.5px solid var(--line)',
          borderRadius: 18,
          padding: '28px 32px 20px',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div style={{ font: "500 11px 'JetBrains Mono', ui-monospace", textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-4)', marginBottom: 18 }}>
          Relation types
        </div>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          margin: '0 -8px',
          padding: '0 8px 8px',
          scrollbarWidth: 'thin',
        }}>
          {groups.map(g => (
            <div key={g.key} style={{ padding: '6px 0 10px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 4px 8px', borderBottom: '0.5px solid var(--line)' }}>
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
                        t.line === 'wavy' ? '1 4' : '0'
                      }
                    />
                    <circle cx="18" cy="7" r="6.5"
                      fill="var(--bg-card)"
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

        <div style={{
          paddingTop: 14,
          marginTop: 4,
          borderTop: '0.5px solid var(--line)',
          font: "500 11px 'JetBrains Mono', ui-monospace",
          color: 'var(--ink-4)',
        }}>
          {Object.keys(EDGE_TYPES).length} relation kinds · rendering follows Settings → edge encoding
        </div>
      </div>
    </div>
  )
}
