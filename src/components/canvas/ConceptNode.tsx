// SPDX-License-Identifier: MIT
import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { Handle, Position, NodeProps, useConnection } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { ConceptNodeBody, useGraphDisplay } from '@nesso-how/graph'
import type { ConceptNodeData } from '@/types/graph'
import { CONCEPT_HANDLE_IN, CONCEPT_HANDLE_OUT } from '@/data/conceptHandles'
import { useGraphStore } from '@/store'

type ConceptNodeType = Node<ConceptNodeData>

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
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectAllOnFocus = useRef(false)
  const skipBlurCommit = useRef(false)
  const updateNodeData = useGraphStore((s) => s.updateNodeData)
  const editNodeId = useGraphStore((s) => s.editNodeId)
  const clearEditNodeId = useGraphStore((s) => s.clearEditNodeId)
  const { showHeatmap, showConfidence } = useGraphDisplay()

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
      input.value.length > 0 &&
      input.selectionStart === 0 &&
      input.selectionEnd === input.value.length
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

  const commit = useCallback(
    (val: string) => {
      const trimmed = val.trim()
      if (trimmed) updateNodeData(id, { text: trimmed })
      setEditing(false)
      focusNodeWrapper()
    },
    [id, updateNodeData, focusNodeWrapper],
  )

  const connection = useConnection()
  const isConnectionTarget =
    connection.inProgress && connection.toNode?.id === id && connection.fromNode?.id !== id

  return (
    <div style={{ position: 'relative' }}>
      <ConceptNodeBody
        rootRef={rootRef}
        className="nesso-node"
        text={data.text}
        selected={selected}
        showHeatmap={showHeatmap}
        showConfidence={showConfidence}
        lastRating={data.lastRating ?? 0}
        reps={data.reps}
        due={data.due}
        cursor={editing ? 'text' : 'grab'}
        userSelect={editing ? 'text' : 'none'}
        connectionTarget={isConnectionTarget}
        hideUnderline={editing}
        onDoubleClick={(e) => {
          e.stopPropagation()
          startEdit()
        }}
      >
        <div style={{ position: 'relative' }}>
          <span
            className="nesso-node-label"
            style={{
              font: '500 16px Fraunces, ui-serif, Georgia, serif',
              letterSpacing: '-0.005em',
              color: 'var(--ink)',
              display: 'block',
              whiteSpace: 'pre',
              visibility: editing ? 'hidden' : 'visible',
            }}
          >
            {editing ? draft : data.text}
          </span>

          {editing && (
            <input
              ref={inputRef}
              className="nodrag nopan"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={(e) => {
                if (skipBlurCommit.current) {
                  skipBlurCommit.current = false
                  return
                }
                commit(e.target.value)
              }}
              onPointerDown={stopGraphPointer}
              onMouseDown={handleInputMouseDown}
              onClick={stopGraphPointer}
              onKeyDown={(e) => {
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
      </ConceptNodeBody>

      <Handle
        id={CONCEPT_HANDLE_OUT}
        type="source"
        position={Position.Right}
        className="nesso-node-handle"
        style={{
          width: 22,
          height: 22,
          background:
            'radial-gradient(circle, var(--accent) 2.5px, var(--bg-card, #fff) 2.5px 4px, transparent 4px)',
          border: 'none',
          borderRadius: '50%',
        }}
      />
      <Handle
        id={CONCEPT_HANDLE_IN}
        type="target"
        position={Position.Left}
        className="nesso-node-handle"
        style={{
          width: 22,
          height: 22,
          background:
            'radial-gradient(circle, var(--accent) 2.5px, var(--bg-card, #fff) 2.5px 4px, transparent 4px)',
          border: 'none',
          borderRadius: '50%',
        }}
      />
      <Handle
        id="in-c1"
        type="target"
        position={Position.Left}
        style={{
          left: '33%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 8,
          height: 8,
          opacity: 0,
          pointerEvents: 'none',
          border: 'none',
          background: 'transparent',
        }}
      />
      <Handle
        id="in-c2"
        type="target"
        position={Position.Left}
        style={{
          left: '67%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 8,
          height: 8,
          opacity: 0,
          pointerEvents: 'none',
          border: 'none',
          background: 'transparent',
        }}
      />
    </div>
  )
}
