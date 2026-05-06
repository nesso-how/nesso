// SPDX-License-Identifier: AGPL-3.0
import { useState, useMemo } from 'react'
import { EDGE_TYPES, EDGE_CATEGORIES } from '@/data/edgeTypes'
import { useGraphStore } from '@/store/graph'
import { daysAgo, type EdgeTypeName } from '@/types/graph'

interface Props {
  open: boolean
  onClose: () => void
}

export function ReviewMode({ open, onClose }: Props) {
  const { nodes, edges, updateNodeData } = useGraphStore()
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)

  const due = useMemo(() => {
    return nodes
      .map(n => ({ ...n, _score: daysAgo(n.data.reviewedAt) * (6 - (n.data.conf ?? 3)) }))
      .filter(n => daysAgo(n.data.reviewedAt) > 7 || n.data.conf <= 3)
      .sort((a, b) => b._score - a._score)
      .slice(0, 8)
  }, [nodes])

  if (!open) return null

  const advance = (newConf: number | null) => {
    if (newConf != null && due[idx]) {
      updateNodeData(due[idx].id, { conf: newConf, reviewedAt: Date.now() })
    }
    setRevealed(false)
    if (idx + 1 >= due.length) onClose()
    else setIdx(i => i + 1)
  }

  if (!due.length) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ font: "500 11px 'JetBrains Mono', ui-monospace", textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--cat-temporal)' }}>
          Review · all caught up
        </div>
        <h2 style={{ margin: '12px 0 8px', font: "500 32px/1.15 'Fraunces', serif" }}>Nothing's stale.</h2>
        <p style={{ font: "400 15px/1.5 'Fraunces', serif", color: 'var(--ink-2)' }}>
          Come back tomorrow, or pick a low-confidence concept yourself.
        </p>
        <Btn primary onClick={onClose}>Close</Btn>
      </Overlay>
    )
  }

  const node = due[idx % due.length]
  const nodeEdges = {
    out: edges.filter(e => e.source === node.id),
    inc: edges.filter(e => e.target === node.id),
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ font: "500 11px 'JetBrains Mono', ui-monospace", textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--cat-causal)' }}>
        Review · {idx + 1} of {due.length}
      </div>
      <h2 style={{ margin: '16px 0 6px', font: "500 44px/1.05 'Fraunces', serif", letterSpacing: '-0.02em' }}>
        {node.data.text}
      </h2>
      <div style={{ font: "400 13px/1.4 'Fraunces', serif", fontStyle: 'italic', color: 'var(--ink-3)', marginBottom: 18 }}>
        Recall its relations before revealing.
      </div>

      {!revealed ? (
        <Btn primary onClick={() => setRevealed(true)}>Reveal</Btn>
      ) : (
        <>
          <div style={{ borderTop: '0.5px dashed var(--line)', paddingTop: 14, marginBottom: 18 }}>
            {nodeEdges.out.map(e => {
              const T = EDGE_TYPES[e.data?.type as EdgeTypeName]
              const C = EDGE_CATEGORIES[T.cat]
              const target = nodes.find(n => n.id === e.target)
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  <span style={{ font: "500 11px 'JetBrains Mono', ui-monospace", color: C.color, minWidth: 110 }}>{T.label}</span>
                  <span style={{ font: "400 14px 'Fraunces', serif" }}>{target?.data.text}</span>
                </div>
              )
            })}
            {nodeEdges.inc.map(e => {
              const T = EDGE_TYPES[e.data?.type as EdgeTypeName]
              const C = EDGE_CATEGORIES[T.cat]
              const source = nodes.find(n => n.id === e.source)
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, opacity: 0.7 }}>
                  <span style={{ font: "500 11px 'JetBrains Mono', ui-monospace", color: C.color, minWidth: 110 }}>← {T.label}</span>
                  <span style={{ font: "400 14px 'Fraunces', serif" }}>{source?.data.text}</span>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(c => (
              <button key={c} onClick={() => advance(c)} style={{
                flex: 1,
                appearance: 'none',
                border: '0.5px solid var(--line)',
                background: `var(--conf-${c})`,
                color: 'var(--paper)',
                font: "600 12px 'JetBrains Mono', ui-monospace",
                padding: 10,
                borderRadius: 8,
                cursor: 'default',
              }}>
                {c}
              </button>
            ))}
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginTop: 8,
            font: "400 10px 'JetBrains Mono', ui-monospace", color: 'var(--ink-4)',
          }}>
            <span>shaky</span><span>confident</span>
          </div>
        </>
      )}
    </Overlay>
  )
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 70,
        background: 'rgba(20, 18, 14, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        width: 520, maxWidth: '92vw',
        background: 'var(--bg-card)',
        border: '0.5px solid var(--line)',
        borderRadius: 18,
        padding: '32px 36px 28px',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {children}
      </div>
    </div>
  )
}

function Btn({ children, primary, onClick }: { children: React.ReactNode; primary?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      appearance: 'none',
      border: primary ? 0 : '0.5px solid var(--line)',
      background: primary ? 'var(--ink)' : 'transparent',
      color: primary ? 'var(--paper)' : 'var(--ink-2)',
      font: "500 12px 'JetBrains Mono', ui-monospace",
      padding: '8px 16px',
      borderRadius: 999,
      cursor: 'default',
    }}>
      {children}
    </button>
  )
}
