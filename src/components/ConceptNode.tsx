import { useState, useRef, useCallback } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import type { ConceptNodeData } from '@/types/graph'
import { useGraphStore } from '@/store/graph'

type ConceptNodeType = Node<ConceptNodeData>

export function ConceptNode({ id, data, selected }: NodeProps<ConceptNodeType>) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.text)
  const inputRef = useRef<HTMLInputElement>(null)
  const { updateNodeData, setSelected, settings } = useGraphStore()
  const showConfidence = settings.showConfidence

  const startEdit = useCallback(() => {
    setDraft(data.text)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 10)
  }, [data.text])

  const commit = useCallback((val: string) => {
    const trimmed = val.trim()
    if (trimmed) updateNodeData(id, { text: trimmed })
    setEditing(false)
  }, [id, updateNodeData])

  const confColor = `var(--conf-${Math.max(1, Math.min(5, data.conf ?? 3))})`
  const isStale = data.reviewed > 14

  return (
    <div
      onDoubleClick={(e) => { e.stopPropagation(); startEdit() }}
      style={{
        position: 'relative',
        padding: '6px 14px',
        borderRadius: 999,
        background: selected ? 'var(--bg-card)' : 'transparent',
        border: selected
          ? `0.5px solid var(--line)`
          : '0.5px solid transparent',
        cursor: editing ? 'text' : 'grab',
        userSelect: 'none',
        minWidth: 60,
      }}
    >
      {/* Selection halo */}
      {selected && (
        <div style={{
          position: 'absolute',
          inset: -6,
          borderRadius: 999,
          border: `1px dashed ${settings.accent}`,
          opacity: 0.7,
          pointerEvents: 'none',
        }} />
      )}

      {/* Confidence dot */}
      {showConfidence && data.conf != null && (
        <div style={{
          position: 'absolute',
          top: 0,
          right: -2,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: confColor,
          boxShadow: isStale ? `0 0 0 3px transparent, 0 0 0 4px ${confColor}44` : 'none',
        }} />
      )}

      {/* Pinned dot */}
      {data.pinned && (
        <div style={{
          position: 'absolute',
          top: 4,
          left: 4,
          width: 3,
          height: 3,
          borderRadius: '50%',
          background: 'var(--ink-4)',
        }} />
      )}

      {/* Text or input */}
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => {
            e.stopPropagation()
            if (e.key === 'Enter') commit(draft)
            if (e.key === 'Escape') { setEditing(false); setDraft(data.text) }
          }}
          onMouseDown={e => e.stopPropagation()}
          style={{
            border: 0,
            outline: 'none',
            background: 'transparent',
            font: '500 16px Fraunces, ui-serif, Georgia, serif',
            letterSpacing: '-0.005em',
            color: 'var(--ink)',
            textAlign: 'center',
            width: Math.max(80, draft.length * 9),
          }}
        />
      ) : (
        <>
          <span style={{
            font: `${selected ? 600 : 500} ${selected ? 17 : 16}px Fraunces, ui-serif, Georgia, serif`,
            letterSpacing: '-0.005em',
            color: 'var(--ink)',
            display: 'block',
            whiteSpace: 'nowrap',
          }}>
            {data.text}
          </span>
          {/* Underline */}
          <div style={{
            position: 'absolute',
            bottom: 5,
            left: 16,
            right: 16,
            height: selected ? 1.4 : 0.8,
            background: 'var(--ink)',
            opacity: selected ? 0.9 : 0.4,
          }} />
        </>
      )}

      {/* React Flow handles — invisible, used for edge connection */}
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 8, height: 8 }} />
    </div>
  )
}
