// SPDX-License-Identifier: MIT
import { useState, useEffect, useRef, useMemo } from 'react'
import type { Node } from '@xyflow/react'
import { useGraphStore } from '@/store'
import type { ConceptNodeData } from '@/types/graph'
import { useT } from '@/i18n'
import { ModalOverlay } from '@/components/ui/ModalOverlay'

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
  const t = useT()
  const nodes = useGraphStore((s) => s.nodes)
  const graphList = useGraphStore((s) => s.graphList)
  const currentGraphId = useGraphStore((s) => s.currentGraphId)
  const selectedNodeId = useGraphStore((s) => (s.selected?.kind === 'node' ? s.selected.id : null))
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
    return q ? sorted.filter((g) => g.name.toLowerCase().includes(q)) : sorted
  }, [graphList, q])

  const conceptResults = useMemo(() => {
    return q ? nodes.filter((n) => n.data.text.toLowerCase().includes(q)) : nodes.slice(0, 6)
  }, [nodes, q])

  const allResults = [
    ...graphResults.map((g) => ({ kind: 'graph' as const, g })),
    ...conceptResults.map((n) => ({ kind: 'concept' as const, n })),
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
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (e.key === 'Enter') {
      const first = allResults[0]
      if (!first) return
      if (first.kind === 'graph') handleSelectGraph(first.g.id)
      else handleSelectNode(first.n)
    }
  }

  const hasResults = graphResults.length > 0 || conceptResults.length > 0
  const showDivider = graphResults.length > 0 && conceptResults.length > 0

  return (
    <ModalOverlay
      open={open}
      onClose={onClose}
      align="top"
      backdropStyle={{ background: 'rgba(20, 18, 14, 0.45)' }}
    >
      <div
        style={{
          width: 440,
          maxWidth: '90vw',
          background: 'var(--bg-elev)',
          border: '0.5px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-5)',
            padding: '12px 16px',
            borderBottom: hasResults ? '0.5px solid var(--line)' : 'none',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="var(--ink-4)"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle cx="6.5" cy="6.5" r="4.5" />
            <path d="M11.5 11.5l3 3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.search.placeholder}
            style={{
              flex: 1,
              appearance: 'none',
              border: 0,
              outline: 0,
              background: 'transparent',
              color: 'var(--ink)',
              fontSize: '14px',
              fontWeight: 400,
              lineHeight: 1,
              fontFamily: 'var(--font-sans)',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                appearance: 'none',
                border: 0,
                background: 'transparent',
                color: 'var(--ink-4)',
                cursor: 'pointer',
                padding: 'var(--space-1)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path
                  d="M3 3l6 6M9 3l-6 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>

        {hasResults && (
          <div className="nesso-scrollbar" style={{ maxHeight: 360, overflowY: 'auto' }}>
            {/* Graphs */}
            {graphResults.length > 0 && (
              <section>
                <SectionLabel>{t.search.graphs}</SectionLabel>
                {graphResults.map((g) => (
                  <ResultRow
                    key={g.id}
                    active={g.id === currentGraphId}
                    label={g.name}
                    meta={timeAgo(g.updatedAt)}
                    onClick={() => handleSelectGraph(g.id)}
                  />
                ))}
              </section>
            )}

            {showDivider && (
              <div style={{ height: '0.5px', background: 'var(--line)', margin: '4px 0' }} />
            )}

            {/* Concepts */}
            {conceptResults.length > 0 && (
              <section>
                <SectionLabel>{t.search.concepts}</SectionLabel>
                {conceptResults.map((node) => (
                  <ResultRow
                    key={node.id}
                    active={node.id === selectedNodeId}
                    label={node.data.text}
                    letterSpacing="-0.005em"
                    onClick={() => handleSelectNode(node)}
                  />
                ))}
              </section>
            )}
          </div>
        )}

        {q && !hasResults && (
          <p
            style={{
              margin: 0,
              padding: '14px 16px',
              fontSize: '13px',
              fontWeight: 400,
              fontFamily: 'var(--font-sans)',
              color: 'var(--ink-4)',
            }}
          >
            {t.search.noResults(query)}
          </p>
        )}
      </div>
    </ModalOverlay>
  )
}

function ResultRow({
  active,
  label,
  meta,
  letterSpacing,
  onClick,
}: {
  active: boolean
  label: string
  meta?: string
  letterSpacing?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        appearance: 'none',
        border: 0,
        background: 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-5)',
        padding: '8px 16px',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--paper-deep)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 'var(--radius-circle)',
          flexShrink: 0,
          background: active ? 'var(--accent)' : 'var(--ink-5)',
        }}
      />
      <span
        style={{
          flex: 1,
          font: active
            ? "500 13px 'Fraunces', ui-serif, Georgia, serif"
            : "400 13px 'Fraunces', ui-serif, Georgia, serif",
          color: 'var(--ink)',
          letterSpacing,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      {meta !== undefined && (
        <span
          style={{
            fontSize: '10.5px',
            fontWeight: 500,
            fontFamily: 'var(--font-mono)',
            color: 'var(--ink-4)',
            flexShrink: 0,
          }}
        >
          {meta}
        </span>
      )}
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '6px 16px 3px',
        fontSize: '10px',
        fontWeight: 500,
        fontFamily: 'var(--font-mono)',
        color: 'var(--ink-4)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      {children}
    </div>
  )
}
