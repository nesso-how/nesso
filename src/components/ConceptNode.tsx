// SPDX-License-Identifier: MIT
import { useState, useRef, useCallback } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import type { ConceptNodeData } from '@/types/graph'
import { CONCEPT_HANDLE_IN, CONCEPT_HANDLE_OUT } from '@/data/conceptHandles'
import { useGraphStore } from '@/store/graph'

type ConceptNodeType = Node<ConceptNodeData>

/** Maps 0=unrated → ink; 1–4 → existing conf CSS vars (skip --conf-3) */
const RATING_COLOR = ['var(--ink)', 'var(--conf-1)', 'var(--conf-2)', 'var(--conf-4)', 'var(--conf-5)'] as const

export function ConceptNode({ id, data, selected }: NodeProps<ConceptNodeType>) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.text)
  const [hovered, setHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { updateNodeData, setSelected, settings } = useGraphStore()
  const showConfidence = settings.showConfidence
  const showHeatmap = settings.showHeatmap

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

  const ratingIdx = Math.max(0, Math.min(4, data.lastRating ?? 0))
  const heatTint = RATING_COLOR[ratingIdx]
  const confColor = showConfidence ? heatTint : 'var(--ink)'
  const isStale = data.reps > 0 && data.due <= Date.now()

  return (
    <div
      onDoubleClick={(e) => { e.stopPropagation(); startEdit() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        padding: '6px 14px',
        borderRadius: 999,
        background: selected || showHeatmap ? 'var(--bg-card)' : 'transparent',
        border: selected || showHeatmap
          ? `0.5px solid var(--line)`
          : '0.5px solid transparent',
        cursor: editing ? 'text' : 'grab',
        userSelect: 'none',
        minWidth: 60,
      }}
    >
      {/* Heatmap overlay — tints background with last rating colour */}
      {showHeatmap && (
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 999,
          background: heatTint,
          opacity: 0.14,
          pointerEvents: 'none',
        }} />
      )}

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


      {/* Text / editing — ghost span always holds the width, input overlays when editing */}
      <div style={{ position: 'relative' }}>
        <span style={{
          font: '500 16px Fraunces, ui-serif, Georgia, serif',
          letterSpacing: '-0.005em',
          color: 'var(--ink)',
          display: 'block',
          whiteSpace: 'pre',
          visibility: editing ? 'hidden' : 'visible',
        }}>
          {editing ? draft : data.text}
        </span>

        {editing && (
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
              position: 'absolute',
              inset: 0,
              border: 0,
              padding: 0,
              margin: 0,
              width: '100%',
              boxSizing: 'border-box',
              background: 'transparent',
              font: '500 16px Fraunces, ui-serif, Georgia, serif',
              letterSpacing: '-0.005em',
              color: 'var(--ink)',
              textAlign: 'center',
              outline: 'none',
            }}
          />
        )}
      </div>

      {/* Underline — color encodes last rating, dashed when due */}
      {!editing && (
        <div style={{
          position: 'absolute',
          bottom: 5,
          left: 16,
          right: 16,
          height: selected ? 1.4 : 0.8,
          background: isStale && showConfidence
            ? `repeating-linear-gradient(90deg, ${confColor} 0, ${confColor} 4px, transparent 4px, transparent 8px)`
            : confColor,
          opacity: selected ? 0.9 : 0.55,
        }} />
      )}

      <Handle
        id={CONCEPT_HANDLE_OUT}
        type="source"
        position={Position.Right}
        style={{
          width: 8, height: 8,
          background: 'var(--accent)',
          border: '1.5px solid var(--bg-card, #fff)',
          opacity: hovered ? 0.85 : 0,
          transition: 'opacity 120ms',
        }}
      />
      <Handle
        id={CONCEPT_HANDLE_IN}
        type="target"
        position={Position.Left}
        style={{
          width: 8, height: 8,
          background: 'var(--accent)',
          border: '1.5px solid var(--bg-card, #fff)',
          opacity: hovered ? 0.85 : 0,
          transition: 'opacity 120ms',
        }}
      />
    </div>
  )
}
