// SPDX-License-Identifier: MIT
import { EDGE_TYPES, EDGE_CATEGORIES } from '@/data/edgeTypes'
import { GlyphSVG } from './GlyphSVG'
import { useGraphStore, selectedNodeSelector, selectedEdgeSelector } from '@/store/graph'
import type { EdgeTypeName } from '@/types/graph'

export function Inspector({ leftOffset = 0 }: { leftOffset?: number }) {
  const selectedNode = useGraphStore(selectedNodeSelector)
  const selectedEdge = useGraphStore(selectedEdgeSelector)

  if (selectedNode) return <NodeInspector leftOffset={leftOffset} />
  if (selectedEdge) return <EdgeInspector leftOffset={leftOffset} />
  return null
}

function NodeInspector({ leftOffset }: { leftOffset: number }) {
  const node = useGraphStore(selectedNodeSelector)!
  const { edges, nodes, updateNodeData, deleteNode, setSelected } = useGraphStore()

  const outgoing = edges.filter(e => e.source === node.id)
  const incoming = edges.filter(e => e.target === node.id)

  const focusNode = (id: string) => setSelected({ kind: 'node', id })

  return (
    <div style={{
      position: 'absolute',
      left: leftOffset + 18,
      top: 62,
      width: 296,
      zIndex: 25,
      background: 'var(--bg-elev)',
      border: '0.5px solid var(--line)',
      borderRadius: 14,
      padding: '16px 16px 14px',
      boxShadow: 'var(--shadow-md)',
    }}>
      {/* Crumb */}
      <div style={{
        font: "500 10.5px 'JetBrains Mono', ui-monospace",
        color: 'var(--ink-4)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      }}>
        <span>Concept</span>
      </div>

      <h3 style={{
        margin: '6px 0 14px',
        font: "500 22px/1.2 'Fraunces', ui-serif, Georgia, serif",
        letterSpacing: '-0.012em',
      }}>
        {node.data.text}
      </h3>

      {/* Confidence */}
      <InspectorRow label="Confidence">
        <div style={{ display: 'flex', gap: 3 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <button
              key={i}
              onClick={() => updateNodeData(node.id, { conf: i })}
              style={{
                appearance: 'none',
                border: 0,
                padding: 0,
                cursor: 'default',
                width: 18,
                height: 18,
                borderRadius: 4,
                background: i <= (node.data.conf ?? 0)
                  ? `var(--conf-${node.data.conf})`
                  : 'var(--paper-deep)',
              }}
            />
          ))}
        </div>
      </InspectorRow>

      {/* Last reviewed */}
      <InspectorRow label="Last reviewed">
        <span style={{
          font: "500 12px 'JetBrains Mono', ui-monospace",
          color: Math.floor((Date.now() - node.data.reviewedAt) / 86_400_000) > 14 ? 'var(--cat-causal)' : 'var(--ink-2)',
        }}>
          {(d => d === 0 ? 'today' : `${d}d ago`)(Math.floor((Date.now() - node.data.reviewedAt) / 86_400_000))}
        </span>
      </InspectorRow>

      {/* Relations */}
      <div style={{ marginTop: 12 }}>
        {outgoing.length > 0 && <EdgeGroupHeader label="Outgoing" count={outgoing.length} />}
        {outgoing.map(e => {
          const T = EDGE_TYPES[e.data?.type as EdgeTypeName]
          const C = EDGE_CATEGORIES[T.cat]
          const target = nodes.find(n => n.id === e.target)
          return (
            <EdgeRow key={e.id} label={T.label} text={target?.data.text ?? ''} color={C.color} glyph={T.glyph} onClick={() => focusNode(e.target)} />
          )
        })}

        {incoming.length > 0 && <EdgeGroupHeader label="Incoming" count={incoming.length} />}
        {incoming.map(e => {
          const T = EDGE_TYPES[e.data?.type as EdgeTypeName]
          const C = EDGE_CATEGORIES[T.cat]
          const source = nodes.find(n => n.id === e.source)
          return (
            <EdgeRow key={e.id} label={`← ${T.label}`} text={source?.data.text ?? ''} color={C.color} glyph={T.glyph} onClick={() => focusNode(e.source)} />
          )
        })}
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex',
        gap: 6,
        marginTop: 14,
        paddingTop: 12,
        borderTop: '0.5px solid var(--line)',
      }}>
        <ActionBtn danger onClick={() => deleteNode(node.id)}>Delete</ActionBtn>
      </div>
    </div>
  )
}

function EdgeInspector({ leftOffset }: { leftOffset: number }) {
  const edge = useGraphStore(selectedEdgeSelector)!
  const { nodes, updateEdgeType, deleteEdge } = useGraphStore()
  const edgeType = edge.data?.type as EdgeTypeName
  const T = EDGE_TYPES[edgeType]
  const C = EDGE_CATEGORIES[T.cat]
  const from = nodes.find(n => n.id === edge.source)
  const to = nodes.find(n => n.id === edge.target)
  const siblings = Object.entries(EDGE_TYPES).filter(([, t]) => t.cat === T.cat) as [EdgeTypeName, typeof T][]

  return (
    <div style={{
      position: 'absolute',
      left: leftOffset + 18,
      top: 62,
      width: 296,
      zIndex: 25,
      background: 'var(--bg-elev)',
      border: '0.5px solid var(--line)',
      borderRadius: 14,
      padding: '16px 16px 14px',
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{
        font: "500 10.5px 'JetBrains Mono', ui-monospace",
        color: 'var(--ink-4)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>Relation</span>
        <span style={{ color: C.color }}>{EDGE_CATEGORIES[T.cat].label}</span>
      </div>

      {/* From → glyph → To */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 18px' }}>
        <span style={{ font: "500 14px 'Fraunces', serif" }}>{from?.data.text}</span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ height: 1, flex: 1, background: C.color, opacity: 0.5, display: 'inline-block' }} />
          <GlyphSVG kind={T.glyph} color={C.color} size={14} />
          <span style={{ height: 1, flex: 1, background: C.color, opacity: 0.5, display: 'inline-block' }} />
        </div>
        <span style={{ font: "500 14px 'Fraunces', serif" }}>{to?.data.text}</span>
      </div>

      <div style={{ font: "500 18px 'JetBrains Mono', ui-monospace", color: C.color, marginBottom: 12 }}>
        {T.label}
      </div>

      {/* Sharpen */}
      <h5 style={{
        margin: '14px 0 6px',
        font: "600 10px 'JetBrains Mono', ui-monospace",
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--ink-4)',
      }}>
        Sharpen the relation
      </h5>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {siblings.map(([k, t]) => (
          <button
            key={k}
            onClick={() => updateEdgeType(edge.id, k)}
            style={{
              font: "500 11px 'JetBrains Mono', ui-monospace",
              padding: '4px 9px',
              borderRadius: 999,
              border: `0.5px solid ${k === edgeType ? C.color : 'var(--line)'}`,
              background: k === edgeType ? C.color : 'transparent',
              color: k === edgeType ? 'var(--paper)' : 'var(--ink-2)',
              cursor: 'default',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{
        display: 'flex',
        gap: 6,
        marginTop: 14,
        paddingTop: 12,
        borderTop: '0.5px solid var(--line)',
      }}>
        <ActionBtn danger onClick={() => deleteEdge(edge.id)}>Delete relation</ActionBtn>
      </div>
    </div>
  )
}

function InspectorRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderTop: '0.5px dashed var(--line)',
    }}>
      <span style={{
        font: "500 11px 'JetBrains Mono', ui-monospace",
        color: 'var(--ink-3)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        {label}
      </span>
      {children}
    </div>
  )
}

function EdgeGroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <h5 style={{
      margin: '14px 0 6px',
      font: "600 10px 'JetBrains Mono', ui-monospace",
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--ink-4)',
    }}>
      {label} · {count}
    </h5>
  )
}

function EdgeRow({ label, text, color, glyph, onClick }: {
  label: string; text: string; color: string; glyph: string; onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '24px 1fr',
        gap: 8,
        alignItems: 'center',
        padding: '5px 6px',
        borderRadius: 5,
        cursor: 'default',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--paper-deep)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <GlyphSVG kind={glyph as any} color={color} size={14} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ font: "500 10.5px 'JetBrains Mono', ui-monospace", color }}>{label}</span>
        <span style={{
          font: "500 13px 'Fraunces', serif",
          color: 'var(--ink)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {text}
        </span>
      </div>
    </div>
  )
}

function ActionBtn({ children, danger, onClick }: { children: React.ReactNode; danger?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        appearance: 'none',
        border: '0.5px solid var(--line)',
        background: 'var(--paper-deep)',
        color: danger ? 'var(--cat-opposition)' : 'var(--ink-2)',
        font: "500 11px 'JetBrains Mono', ui-monospace",
        padding: '7px 8px',
        borderRadius: 7,
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? 'rgba(138,46,74,0.06)' : 'var(--bg-card)'
        e.currentTarget.style.color = danger ? 'var(--cat-opposition)' : 'var(--ink)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--paper-deep)'
        e.currentTarget.style.color = danger ? 'var(--cat-opposition)' : 'var(--ink-2)'
      }}
    >
      {children}
    </button>
  )
}
