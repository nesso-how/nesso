// SPDX-License-Identifier: MIT
import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { Handle, Position, NodeProps, useConnection } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import type { ConceptNodeData } from '@/types/graph'
import { CONCEPT_HANDLE_IN, CONCEPT_HANDLE_OUT } from '@/data/conceptHandles'
import { useGraphStore } from '@/store/graph'

type ConceptNodeType = Node<ConceptNodeData>

/** Maps 0=unrated → ink; 1–4 → existing conf CSS vars (skip --conf-3) */
const RATING_COLOR = ['var(--ink)', 'var(--conf-1)', 'var(--conf-2)', 'var(--conf-4)', 'var(--conf-5)'] as const

function caretIndexFromCenteredClick(input: HTMLInputElement, clientX: number): number {
  const style = window.getComputedStyle(input)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return input.value.length

  ctx.font = style.font
  const text = input.value
  if (!text) return 0

  const textWidth = ctx.measureText(text).width
  const rect = input.getBoundingClientRect()
  const clickX = clientX - rect.left
  const textLeft = (rect.width - textWidth) / 2

  let index = text.length
  let bestDist = Infinity
  for (let i = 0; i <= text.length; i++) {
    const x = textLeft + ctx.measureText(text.slice(0, i)).width
    const dist = Math.abs(x - clickX)
    if (dist < bestDist) {
      bestDist = dist
      index = i
    }
  }
  return index
}

export function ConceptNode({ id, data, selected }: NodeProps<ConceptNodeType>) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.text)
  const [hovered, setHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectAllOnFocus = useRef(false)
  const skipBlurCommit = useRef(false)
  const { updateNodeData, settings, graphDisplay, editNodeId, clearEditNodeId } = useGraphStore()
  const showConfidence = settings.showConfidence
  const showHeatmap = graphDisplay.showHeatmap

  const startEdit = useCallback(() => {
    setDraft(data.text)
    selectAllOnFocus.current = true
    setEditing(true)
  }, [data.text])

  useEffect(() => {
    if (editNodeId !== id) return
    clearEditNodeId()
    startEdit()
  }, [editNodeId, id, clearEditNodeId, startEdit])

  useLayoutEffect(() => {
    if (!editing || !selectAllOnFocus.current) return
    selectAllOnFocus.current = false
    const input = inputRef.current
    if (!input) return
    input.focus()
    input.select()
  }, [editing])

  const stopGraphPointer = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation()
  }, [])

  const handleInputMouseDown = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation()
    const input = e.currentTarget
    const fullySelected =
      input.value.length > 0
      && input.selectionStart === 0
      && input.selectionEnd === input.value.length
    if (!fullySelected) return

    e.preventDefault()
    const pos = caretIndexFromCenteredClick(input, e.clientX)
    input.setSelectionRange(pos, pos)
  }, [])

  const focusNodeWrapper = useCallback(() => {
    requestAnimationFrame(() => {
      ;(rootRef.current?.closest('.react-flow__node') as HTMLElement | null)?.focus()
    })
  }, [])

  const commit = useCallback((val: string) => {
    const trimmed = val.trim()
    if (trimmed) updateNodeData(id, { text: trimmed })
    setEditing(false)
    focusNodeWrapper()
  }, [id, updateNodeData, focusNodeWrapper])

  const connection = useConnection()
  const isConnectionTarget = connection.inProgress && connection.toNode?.id === id && connection.fromNode?.id !== id

  const ratingIdx = Math.max(0, Math.min(4, data.lastRating ?? 0))
  const heatTint = RATING_COLOR[ratingIdx]
  const confColor = showConfidence ? heatTint : 'var(--ink)'
  const isStale = data.reps > 0 && data.due <= Date.now()

  return (
    <div
      ref={rootRef}
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
        userSelect: editing ? 'text' : 'none',
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

      {/* Connection target highlight */}
      {isConnectionTarget && (
        <div style={{
          position: 'absolute',
          inset: -4,
          borderRadius: 999,
          border: '1.5px dotted color-mix(in srgb, var(--accent) 65%, transparent)',
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
            className="nodrag nopan"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={e => {
              if (skipBlurCommit.current) {
                skipBlurCommit.current = false
                return
              }
              commit(e.target.value)
            }}
            onPointerDown={stopGraphPointer}
            onMouseDown={handleInputMouseDown}
            onClick={stopGraphPointer}
            onKeyDown={e => {
              e.stopPropagation()
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault()
                skipBlurCommit.current = true
                commit(e.currentTarget.value)
              }
            }}
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
          width: 22, height: 22,
          background: 'radial-gradient(circle, var(--accent) 2.5px, var(--bg-card, #fff) 2.5px 4px, transparent 4px)',
          border: 'none',
          borderRadius: '50%',
          opacity: hovered ? 0.85 : 0,
          transition: 'opacity 120ms',
        }}
      />
      <Handle
        id={CONCEPT_HANDLE_IN}
        type="target"
        position={Position.Left}
        style={{
          width: 22, height: 22,
          background: 'radial-gradient(circle, var(--accent) 2.5px, var(--bg-card, #fff) 2.5px 4px, transparent 4px)',
          border: 'none',
          borderRadius: '50%',
          opacity: hovered ? 0.85 : 0,
          transition: 'opacity 120ms',
        }}
      />
      {/* Invisible target handles distributed at 33% and 67% of the node width.
          pointerEvents:none lets node-drag events pass through.
          Together with the left/right handles and connectionRadius=35 they cover
          the full node width without bleeding into nearby nodes. */}
      <Handle
        id="in-c1"
        type="target"
        position={Position.Left}
        style={{
          left: '33%', top: '50%', transform: 'translate(-50%, -50%)',
          width: 8, height: 8,
          opacity: 0, pointerEvents: 'none',
          border: 'none', background: 'transparent',
        }}
      />
      <Handle
        id="in-c2"
        type="target"
        position={Position.Left}
        style={{
          left: '67%', top: '50%', transform: 'translate(-50%, -50%)',
          width: 8, height: 8,
          opacity: 0, pointerEvents: 'none',
          border: 'none', background: 'transparent',
        }}
      />
    </div>
  )
}
