// SPDX-License-Identifier: MIT
import { useEffect, useMemo, useRef, useState } from 'react'
import { RELATION_CATEGORIES, RELATION_TYPES, isPrimaryRelationType } from '@/data/relationTypes'
import { frequentRelationTypes } from '@/data/relationUsage'
import { useGraphStore } from '@/store/graph'
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

function RelationChip({
  id,
  color,
  label,
  onPick,
}: {
  id: EdgeTypeName
  color: string
  label: string
  onPick: (type: EdgeTypeName) => void
}) {
  return (
    <button
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
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color
        e.currentTarget.style.color = color
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--line)'
        e.currentTarget.style.color = 'var(--ink-2)'
      }}
    >
      {label}
    </button>
  )
}

export function RelationPicker({ screenX, screenY, fromText, toText, onPick, onCancel }: Props) {
  const t = useT()
  const edges = useGraphStore((s) => s.edges)
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const q = query.trim().toLowerCase()
  const frequentTypes = useMemo(() => frequentRelationTypes(edges), [edges])
  const showFrequent = !q && !showAll && frequentTypes.length > 0

  const groups = Object.entries(RELATION_CATEGORIES)
    .map(([k, c]) => ({
      key: k as EdgeCategory,
      ...c,
      types: (
        Object.entries(RELATION_TYPES) as [EdgeTypeName, (typeof RELATION_TYPES)[EdgeTypeName]][]
      ).filter(([id, edgeDef]) => {
        if (edgeDef.cat !== k) return false
        if (!q && !showAll && !isPrimaryRelationType(id)) return false
        if (q) return t.relationTypes.types[id].toLowerCase().includes(q) || id.includes(q)
        return true
      }),
    }))
    .filter((g) => g.types.length > 0)

  const left = Math.min(screenX + 8, window.innerWidth - 320)
  const top = Math.min(screenY + 8, window.innerHeight - 460)

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <div
        onClick={(e) => e.stopPropagation()}
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
          <div
            style={{
              font: "500 10.5px 'JetBrains Mono', ui-monospace",
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--ink-4)',
              marginBottom: 4,
            }}
          >
            {t.relationTypes.newRelation}
          </div>
          <div style={{ font: "500 14px 'Fraunces', serif", letterSpacing: '-0.005em' }}>
            <span>{fromText}</span>
            <span style={{ color: 'var(--ink-4)', padding: '0 6px' }}>→</span>
            <span>{toText}</span>
          </div>
        </div>

        <div style={{ padding: '10px 14px 0' }}>
          <input
            ref={searchRef}
            type="text"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.relationTypes.searchPlaceholder}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'var(--paper-deep)',
              border: '0.5px solid var(--line)',
              borderRadius: 8,
              padding: '5px 10px',
              font: "400 11px 'JetBrains Mono', ui-monospace",
              color: 'var(--ink-1)',
              outline: 'none',
            }}
          />
        </div>

        <div
          className="nesso-scrollbar"
          style={{ maxHeight: 380, overflowY: 'auto', padding: '10px 0 0' }}
        >
          <div style={{ padding: '0 14px' }}>
            {showFrequent && (
              <div
                style={{
                  padding: '0 0 10px',
                  marginBottom: 6,
                  borderBottom: '0.5px solid var(--line)',
                }}
              >
                <div
                  style={{
                    font: "600 9.5px 'JetBrains Mono', ui-monospace",
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--ink-4)',
                    padding: '0 0 6px',
                  }}
                >
                  {t.relationTypes.frequentInGraph}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {frequentTypes.map((id) => {
                    const cat = RELATION_TYPES[id].cat
                    const color = RELATION_CATEGORIES[cat].color
                    return (
                      <RelationChip
                        key={id}
                        id={id}
                        color={color}
                        label={t.relationTypes.types[id]}
                        onPick={onPick}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {groups.length === 0 ? (
              <div
                style={{
                  padding: '20px 0 8px',
                  textAlign: 'center',
                  font: "400 11px 'JetBrains Mono', ui-monospace",
                  color: 'var(--ink-4)',
                  fontStyle: 'italic',
                }}
              >
                {t.relationTypes.noResults}
              </div>
            ) : (
              groups.map((g) => (
                <div key={g.key} style={{ padding: '8px 0 4px' }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 0 6px' }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: g.color,
                        display: 'inline-block',
                      }}
                    />
                    <span
                      style={{
                        font: "600 9.5px 'JetBrains Mono', ui-monospace",
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: g.color,
                      }}
                    >
                      {t.relationTypes.categories[g.key].label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {g.types.map(([id]) => (
                      <RelationChip
                        key={id}
                        id={id}
                        color={g.color}
                        label={t.relationTypes.types[id]}
                        onPick={onPick}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {!q && (
          <div
            style={{ padding: '8px 14px 0', borderTop: '0.5px solid var(--line)', marginTop: 10 }}
          >
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              style={{
                appearance: 'none',
                border: 'none',
                background: 'none',
                padding: 0,
                font: "400 10.5px 'JetBrains Mono', ui-monospace",
                color: 'var(--ink-4)',
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: 2,
              }}
            >
              {showAll ? t.relationTypes.showCommonRelations : t.relationTypes.showAllRelations}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
