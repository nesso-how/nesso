// SPDX-License-Identifier: MIT
import { useState, useEffect, useRef } from 'react'
import type { Node } from '@xyflow/react'
import { useGraphStore } from '@/store/graph'
import type { ConceptNodeData } from '@/types/graph'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (node: Node<ConceptNodeData>) => void
}

export function SearchDialog({ open, onClose, onSelect }: Props) {
  const nodes = useGraphStore(s => s.nodes)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  if (!open) return null

  const q = query.trim().toLowerCase()
  const results = q
    ? nodes.filter(n => n.data.text.toLowerCase().includes(q))
    : nodes.slice(0, 8)

  const handleSelect = (node: Node<ConceptNodeData>) => {
    onSelect(node)
    onClose()
  }

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
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px',
          borderBottom: results.length > 0 ? '0.5px solid var(--line)' : 'none',
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--ink-4)" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="6.5" cy="6.5" r="4.5" /><path d="M11.5 11.5l3 3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'Enter' && results.length > 0) handleSelect(results[0])
            }}
            placeholder="Search concepts…"
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

        {results.length > 0 && (
          <ul style={{ margin: 0, padding: '4px 0', listStyle: 'none', maxHeight: 320, overflowY: 'auto', scrollbarWidth: 'thin' }}>
            {results.map(node => (
              <li key={node.id}>
                <button
                  onClick={() => handleSelect(node)}
                  style={{
                    width: '100%', appearance: 'none', border: 0,
                    background: 'transparent', cursor: 'default',
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 16px', textAlign: 'left',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-deep)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{
                    font: "400 14px/1 'Inter', system-ui",
                    color: 'var(--ink)', flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {node.data.text}
                  </span>
                  <ConfDots conf={node.data.conf} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {q && results.length === 0 && (
          <p style={{
            margin: 0, padding: '14px 16px',
            font: "400 13px 'Inter', system-ui",
            color: 'var(--ink-4)',
          }}>No concepts match "{query}".</p>
        )}
      </div>
    </div>
  )
}

function ConfDots({ conf }: { conf: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, flexShrink: 0 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%',
          background: i <= conf ? `var(--conf-${conf})` : 'var(--paper-deep)',
        }} />
      ))}
    </span>
  )
}
