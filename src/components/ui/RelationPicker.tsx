// SPDX-License-Identifier: MIT
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  RELATION_CATEGORY_COLORS,
  RELATION_TYPES,
  isPrimaryRelationType,
  buildRelationGroups,
} from '@/data/relationTypes'
import { frequentRelationTypes } from '@/data/relationUsage'
import { useGraphStore } from '@/store'
import type { RelationTypeName } from '@/types/graph'
import { useT } from '@/i18n'

interface Props {
  screenX: number
  screenY: number
  fromText: string
  toText: string
  onPick: (type: RelationTypeName) => void
  onCancel: () => void
}

function RelationChip({
  id,
  color,
  label,
  onPick,
}: {
  id: RelationTypeName
  color: string
  label: string
  onPick: (type: RelationTypeName) => void
}) {
  return (
    <button
      data-testid={`relation-chip-${id}`}
      onClick={() => onPick(id)}
      style={{
        appearance: 'none',
        border: '0.5px solid var(--line)',
        background: 'transparent',
        color: 'var(--ink-2)',
        fontSize: '11px',
        fontWeight: 500,
        fontFamily: 'var(--font-mono)',
        padding: '4px 9px',
        borderRadius: 'var(--radius-pill)',
        cursor: 'pointer',
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

  const groups = buildRelationGroups((id) => {
    if (!q && !showAll && !isPrimaryRelationType(id)) return false
    if (q) return t.relationTypes.types[id].toLowerCase().includes(q) || id.includes(q)
    return true
  })

  // The onConnect path has no pointer coordinates (0,0) — center the picker
  // instead of pinning it to the top-left corner.
  const centered = screenX === 0 && screenY === 0
  const left = centered
    ? Math.max(8, (window.innerWidth - 300) / 2)
    : Math.min(screenX + 8, window.innerWidth - 320)
  const top = centered
    ? Math.max(8, (window.innerHeight - 460) / 2)
    : Math.min(screenY + 8, window.innerHeight - 460)

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
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: '12px 0 12px',
          fontSize: '11.5px',
          lineHeight: 1.4,
          fontFamily: 'var(--font-sans)',
        }}
      >
        <div style={{ padding: '0 14px 10px', borderBottom: '0.5px solid var(--line)' }}>
          <div
            style={{
              fontSize: '10.5px',
              fontWeight: 500,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--ink-4)',
              marginBottom: 4,
            }}
          >
            {t.relationTypes.newRelation}
          </div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.005em',
            }}
          >
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
              borderRadius: 'var(--radius-md)',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 400,
              fontFamily: 'var(--font-mono)',
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
                    fontSize: '9.5px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--ink-4)',
                    padding: '0 0 6px',
                  }}
                >
                  {t.relationTypes.frequentInGraph}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {frequentTypes.map((id) => {
                    const cat = RELATION_TYPES[id].cat
                    const color = RELATION_CATEGORY_COLORS[cat].color
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
                  fontSize: '11px',
                  fontWeight: 400,
                  fontFamily: 'var(--font-mono)',
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
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: '0 0 6px',
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 'var(--radius-circle)',
                        background: g.color,
                        display: 'inline-block',
                      }}
                    />
                    <span
                      style={{
                        fontSize: '9.5px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: g.color,
                      }}
                    >
                      {t.relationTypes.categories[g.key].label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
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
                fontSize: '10.5px',
                fontWeight: 400,
                fontFamily: 'var(--font-mono)',
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
