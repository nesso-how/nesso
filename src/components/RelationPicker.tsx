// SPDX-License-Identifier: MIT
import { EDGE_CATEGORIES, EDGE_TYPES } from '@/data/edgeTypes'
import type { EdgeCategory, EdgeTypeName } from '@/types/graph'
import { useT } from '@/i18n'

interface Props {
  screenX: number
  screenY: number
  fromText: string
  toText: string
  onPick: (type: EdgeTypeName) => void
  onCancel: () => void
}

export function RelationPicker({ screenX, screenY, fromText, toText, onPick, onCancel }: Props) {
  const t = useT()
  const groups = Object.entries(EDGE_CATEGORIES).map(([k, c]) => ({
    key: k as EdgeCategory,
    ...c,
    types: Object.entries(EDGE_TYPES).filter(([, edgeDef]) => edgeDef.cat === k) as [EdgeTypeName, (typeof EDGE_TYPES)[EdgeTypeName]][],
  }))

  const left = Math.min(screenX + 8, window.innerWidth - 320)
  const top = Math.min(screenY + 8, window.innerHeight - 460)

  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, zIndex: 60 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          left,
          top,
          width: 300,
          background: 'var(--bg-elev)',
          border: '0.5px solid var(--line)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-lg)',
          padding: '12px 0 12px',
          font: "11.5px/1.4 'Inter', system-ui",
        }}
      >
        <div style={{ padding: '0 14px 10px', borderBottom: '0.5px solid var(--line)' }}>
          <div style={{
            font: "500 10.5px 'JetBrains Mono', ui-monospace",
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--ink-4)',
            marginBottom: 4,
          }}>
            {t.edgeTypes.newRelation}
          </div>
          <div style={{ font: "500 14px 'Fraunces', serif", letterSpacing: '-0.005em' }}>
            <span>{fromText}</span>
            <span style={{ color: 'var(--ink-4)', padding: '0 6px' }}>→</span>
            <span>{toText}</span>
          </div>
        </div>

        <div className="nesso-scrollbar" style={{ maxHeight: 380, overflowY: 'auto', padding: '10px 0 14px' }}>
          <div style={{ padding: '0 14px' }}>
            {groups.map(g => (
              <div key={g.key} style={{ padding: '8px 0 4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 0 6px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: g.color, display: 'inline-block' }} />
                  <span style={{
                    font: "600 9.5px 'JetBrains Mono', ui-monospace",
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: g.color,
                  }}>
                    {t.edgeTypes.categories[g.key].label}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {g.types.map(([id]) => (
                    <button
                      key={id}
                      onClick={() => onPick(id)}
                      style={{
                        appearance: 'none',
                        border: '0.5px solid var(--line)',
                        background: 'transparent',
                        color: 'var(--ink-2)',
                        font: "500 11px 'JetBrains Mono', ui-monospace",
                        padding: '4px 9px',
                        borderRadius: 999,
                        cursor: 'default',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = g.color
                        e.currentTarget.style.color = g.color
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--line)'
                        e.currentTarget.style.color = 'var(--ink-2)'
                      }}
                    >
                      {t.edgeTypes.types[id]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
