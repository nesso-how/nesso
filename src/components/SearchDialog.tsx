// SPDX-License-Identifier: MIT
import { useState, useEffect, useRef, useMemo } from 'react'
import type { Node } from '@xyflow/react'
import { useGraphStore } from '@/store/graph'
import type { ConceptNodeData } from '@/types/graph'

interface Props {
  open: boolean
  onClose: () => void
  onSelectNode: (node: Node<ConceptNodeData>) => void
  onSelectGraph: (id: string) => void
}

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return `${Math.floor(d / 7)}w ago`
}

export function SearchDialog({ open, onClose, onSelectNode, onSelectGraph }: Props) {
  const { nodes, graphList, currentGraphId } = useGraphStore()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const q = query.trim().toLowerCase()

  const graphResults = useMemo(() => {
    const sorted = [...graphList].sort((a, b) => b.updatedAt - a.updatedAt)
    return q ? sorted.filter(g => g.name.toLowerCase().includes(q)) : sorted
  }, [graphList, q])

  const conceptResults = useMemo(() => {
    return q
      ? nodes.filter(n => n.data.text.toLowerCase().includes(q))
      : nodes.slice(0, 6)
  }, [nodes, q])

  const allResults = [
    ...graphResults.map(g => ({ kind: 'graph' as const, g })),
    ...conceptResults.map(n => ({ kind: 'concept' as const, n })),
  ]

  const handleSelectGraph = (id: string) => {
    onSelectGraph(id)
    onClose()
  }

  const handleSelectNode = (node: Node<ConceptNodeData>) => {
    onSelectNode(node)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'Enter') {
      const first = allResults[0]
      if (!first) return
      if (first.kind === 'graph') handleSelectGraph(first.g.id)
      else handleSelectNode(first.n)
    }
  }

  if (!open) return null

  const hasResults = graphResults.length > 0 || conceptResults.length > 0
  const showDivider = graphResults.length > 0 && conceptResults.length > 0

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 75,
        background: 'rgba(20, 18, 14, 0.45)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 120,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 440, maxWidth: '90vw',
          background: 'var(--bg-elev)',
          border: '0.5px solid var(--line)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px',
          borderBottom: hasResults ? '0.5px solid var(--line)' : 'none',
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--ink-4)" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="6.5" cy="6.5" r="4.5" /><path d="M11.5 11.5l3 3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search graphs and concepts…"
            style={{
              flex: 1, appearance: 'none', border: 0, outline: 0,
              background: 'transparent', color: 'var(--ink)',
              font: "400 14px/1 'Inter', system-ui",
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                appearance: 'none', border: 0, background: 'transparent',
                color: 'var(--ink-4)', cursor: 'default', padding: 2,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {hasResults && (
          <div style={{ maxHeight: 360, overflowY: 'auto', scrollbarWidth: 'thin' }}>
            {/* Graphs */}
            {graphResults.length > 0 && (
              <section>
                <SectionLabel>Graphs</SectionLabel>
                {graphResults.map(g => {
                  const active = g.id === currentGraphId
                  return (
                    <button
                      key={g.id}
                      onClick={() => handleSelectGraph(g.id)}
                      style={{
                        width: '100%', appearance: 'none', border: 0,
                        background: 'transparent', cursor: 'default',
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 16px', textAlign: 'left',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-deep)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        background: active ? 'var(--accent)' : 'var(--ink-5)',
                      }} />
                      <span style={{
                        flex: 1,
                        font: active ? "500 13px 'Fraunces', ui-serif, Georgia, serif" : "13px 'Fraunces', ui-serif, Georgia, serif",
                        color: 'var(--ink)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {g.name}
                      </span>
                      <span style={{ font: "500 10.5px 'JetBrains Mono', ui-monospace", color: 'var(--ink-4)', flexShrink: 0 }}>
                        {active ? 'open' : timeAgo(g.updatedAt)}
                      </span>
                    </button>
                  )
                })}
              </section>
            )}

            {showDivider && (
              <div style={{ height: '0.5px', background: 'var(--line)', margin: '4px 0' }} />
            )}

            {/* Concepts */}
            {conceptResults.length > 0 && (
              <section>
                <SectionLabel>Concepts</SectionLabel>
                {conceptResults.map(node => (
                  <button
                    key={node.id}
                    onClick={() => handleSelectNode(node)}
                    style={{
                      width: '100%', appearance: 'none', border: 0,
                      background: 'transparent', cursor: 'default',
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 16px', textAlign: 'left',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-deep)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="var(--ink-5)" strokeWidth="1.3" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <circle cx="6" cy="6" r="4" />
                    </svg>
                    <span style={{
                      flex: 1, font: "400 13px 'Inter', system-ui",
                      color: 'var(--ink)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {node.data.text}
                    </span>
                    <RatingDots lastRating={node.data.lastRating ?? 0} />
                  </button>
                ))}
              </section>
            )}
          </div>
        )}

        {q && !hasResults && (
          <p style={{
            margin: 0, padding: '14px 16px',
            font: "400 13px 'Inter', system-ui",
            color: 'var(--ink-4)',
          }}>
            No results for "{query}".
          </p>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '6px 16px 3px',
      font: "500 10px 'JetBrains Mono', ui-monospace",
      color: 'var(--ink-4)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
    }}>
      {children}
    </div>
  )
}

function RatingDots({ lastRating }: { lastRating: number }) {
  const r = Math.min(4, Math.max(0, lastRating))
  const fill = r === 0 ? 'var(--paper-deep)' : `var(--conf-${r})`
  return (
    <span style={{ display: 'inline-flex', gap: 2, flexShrink: 0 }}>
      {[1, 2, 3, 4].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%',
          background: i <= r ? fill : 'var(--paper-deep)',
        }} />
      ))}
    </span>
  )
}
