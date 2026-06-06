// SPDX-License-Identifier: MIT
import { useState } from 'react'
import { RELATION_CATEGORIES, RELATION_TYPES } from '@/data/relationTypes'
import { GlyphSVG } from './GlyphSVG'
import { CloseButton } from './CloseButton'
import { ModalOverlay } from './ui/ModalOverlay'
import { useGraphStore } from '@/store/graph'
import type { EdgeCategory, EdgeTypeName } from '@/types/graph'
import { useT } from '@/i18n'

const RELATION_TYPES_DOCS_URL = 'https://nesso.how/docs/reference/relation-types/'

interface Props {
  open: boolean
  onClose: () => void
}

export function RelationTypesDialog({ open, onClose }: Props) {
  const t = useT()
  const encoding = useGraphStore((s) => s.graphDisplay.edgeEncoding)
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<EdgeCategory | null>(null)

  const q = query.trim().toLowerCase()

  const groups = Object.entries(RELATION_CATEGORIES)
    .map(([k, c]) => ({
      key: k as EdgeCategory,
      ...c,
      types: (
        Object.entries(RELATION_TYPES) as [EdgeTypeName, (typeof RELATION_TYPES)[EdgeTypeName]][]
      ).filter(([id, edgeDef]) => {
        if (edgeDef.cat !== k) return false
        if (activeCategory !== null && activeCategory !== k) return false
        if (q) return t.relationTypes.types[id].toLowerCase().includes(q) || id.includes(q)
        return true
      }),
    }))
    .filter((g) => g.types.length > 0)

  const totalTypes = Object.keys(RELATION_TYPES).length
  const visibleTypes = groups.reduce((acc, g) => acc + g.types.length, 0)
  const isFiltered = q !== '' || activeCategory !== null

  return (
    <ModalOverlay open={open} onClose={onClose}>
      <div
        style={{
          position: 'relative',
          width: 520,
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
        <div
          style={{
            font: "500 11px 'JetBrains Mono', ui-monospace",
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--ink-4)',
            marginBottom: 14,
          }}
        >
          {t.relationTypes.dialogTitle}
        </div>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <CloseButton large onClick={onClose} />
        </div>

        <input
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
            padding: '7px 12px',
            font: "400 12px 'JetBrains Mono', ui-monospace",
            color: 'var(--ink-1)',
            outline: 'none',
            marginBottom: 10,
          }}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
          <button
            onClick={() => setActiveCategory(null)}
            style={{
              padding: '3px 10px',
              borderRadius: 20,
              border: `0.5px solid ${activeCategory === null ? 'var(--ink-2)' : 'var(--line)'}`,
              background: activeCategory === null ? 'var(--paper-deep)' : 'transparent',
              font: "500 10.5px 'JetBrains Mono', ui-monospace",
              color: activeCategory === null ? 'var(--ink-2)' : 'var(--ink-4)',
              cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            {t.relationTypes.allCategories}
          </button>
          {(
            Object.entries(RELATION_CATEGORIES) as [
              EdgeCategory,
              (typeof RELATION_CATEGORIES)[EdgeCategory],
            ][]
          ).map(([k, c]) => {
            const isActive = activeCategory === k
            return (
              <button
                key={k}
                onClick={() => setActiveCategory(isActive ? null : k)}
                style={{
                  padding: '3px 10px',
                  borderRadius: 20,
                  border: `0.5px solid ${isActive ? c.color : 'var(--line)'}`,
                  background: isActive ? 'var(--paper-deep)' : 'transparent',
                  font: "500 10.5px 'JetBrains Mono', ui-monospace",
                  color: isActive ? c.color : 'var(--ink-4)',
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                {t.relationTypes.categories[k].label}
              </button>
            )
          })}
        </div>

        <div
          className="nesso-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
            margin: '0 -8px',
            padding: '0 8px 8px',
          }}
        >
          {groups.length === 0 ? (
            <div
              style={{
                padding: '32px 0',
                textAlign: 'center',
                font: "400 12px 'JetBrains Mono', ui-monospace",
                color: 'var(--ink-4)',
                fontStyle: 'italic',
              }}
            >
              {t.relationTypes.noResults}
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.key} style={{ padding: '6px 0 10px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                    padding: '0 4px 8px',
                    borderBottom: '0.5px solid var(--line)',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: g.color,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      font: "600 10.5px 'JetBrains Mono', ui-monospace",
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: g.color,
                    }}
                  >
                    {t.relationTypes.categories[g.key].label}
                  </span>
                  <small
                    style={{
                      color: 'var(--ink-4)',
                      fontSize: 12,
                      fontStyle: 'italic',
                      fontFamily: "'Inter', system-ui",
                    }}
                  >
                    {t.relationTypes.categories[g.key].subtitle}
                  </small>
                </div>

                {g.types.map(([id, edgeDef]) => (
                  <div
                    key={id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '36px 1fr auto',
                      gap: 8,
                      alignItems: 'center',
                      padding: '6px 4px',
                      borderRadius: 6,
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLElement).style.background = 'var(--paper-deep)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                    }}
                  >
                    <svg width="36" height="14" viewBox="0 0 36 14">
                      <path
                        d="M2 7 Q 18 7 34 7"
                        fill="none"
                        stroke={encoding === 'minimal' ? 'var(--ink-3)' : g.color}
                        strokeWidth={1.4}
                        strokeLinecap="round"
                        strokeDasharray={
                          edgeDef.line === 'dashed'
                            ? '6 5'
                            : edgeDef.line === 'dotted'
                              ? '0.1 5'
                              : edgeDef.line === 'wavy'
                                ? '1 4'
                                : '0'
                        }
                      />
                      <circle
                        cx="18"
                        cy="7"
                        r="6.5"
                        fill="var(--bg-card)"
                        stroke={encoding === 'minimal' ? 'var(--ink-3)' : g.color}
                        strokeWidth={0.8}
                      />
                      <g transform="translate(11, 0)">
                        <GlyphSVG
                          kind={edgeDef.glyph}
                          color={encoding === 'minimal' ? 'var(--ink-3)' : g.color}
                          size={14}
                        />
                      </g>
                    </svg>

                    <span
                      style={{
                        font: "500 12px 'JetBrains Mono', ui-monospace",
                        color: encoding === 'minimal' ? 'var(--ink-2)' : g.color,
                      }}
                    >
                      {t.relationTypes.types[id]}
                    </span>

                    {edgeDef.inverse === 'self' && (
                      <span
                        style={{
                          color: 'var(--ink-4)',
                          fontSize: 11,
                          fontFamily: "'Inter', system-ui",
                          fontStyle: 'italic',
                        }}
                      >
                        {t.relationTypes.symmetric}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        <div
          style={{
            paddingTop: 14,
            marginTop: 4,
            borderTop: '0.5px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            font: "500 11px 'JetBrains Mono', ui-monospace",
            color: 'var(--ink-4)',
          }}
        >
          <span>
            {isFiltered
              ? t.relationTypes.filteredKinds(visibleTypes, totalTypes)
              : t.relationTypes.relationKinds(totalTypes)}
          </span>
          <a
            href={RELATION_TYPES_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--ink-4)',
              textDecoration: 'underline',
              textUnderlineOffset: 2,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--ink-2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--ink-4)'
            }}
          >
            {t.relationTypes.docsLink}
          </a>
        </div>
      </div>
    </ModalOverlay>
  )
}
