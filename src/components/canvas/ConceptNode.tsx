// SPDX-License-Identifier: MIT
import { useState, useRef, useCallback, useLayoutEffect } from 'react'
import { Handle, Position, NodeProps, useConnection } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { ConceptNodeBody, useGraphDisplay } from '@nesso-how/graph'
import type { ConceptNodeData } from '@/types/graph'
import { CONCEPT_HANDLE_IN, CONCEPT_HANDLE_OUT } from '@/data/conceptHandles'
import { isOnboardingStep } from '@/components/onboarding/onboardingSteps'
import { useGraphStore } from '@/store'

type ConceptNodeType = Node<ConceptNodeData>

function caretIndexFromCenteredClick(input: HTMLInputElement, clientX: number): number {
  const style = window.getComputedStyle(input)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return input.value.length

  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
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
  const onboardingStep = useGraphStore((s) => s.onboardingStep)
  const firstNodeId = useGraphStore((s) => s.nodes[0]?.id ?? null)
  const secondNodeId = useGraphStore((s) => s.nodes[1]?.id ?? null)
  const clearEditNodeId = useGraphStore((s) => s.clearEditNodeId)
  const requestEditNode = useGraphStore((s) => s.requestEditNode)
  const { showHeatmap } = useGraphDisplay()

  const startEdit = useCallback(() => {
    setDraft(data.text)
    selectAllOnFocus.current = true
    setEditing(true)
  }, [data.text])

  const focusNodeWrapper = useCallback(() => {
    requestAnimationFrame(() => {
      ;(rootRef.current?.closest('.react-flow__node') as HTMLElement | null)?.focus()
    })
  }, [])

  const finishEdit = useCallback(() => {
    if (useGraphStore.getState().editNodeId === id) clearEditNodeId()
    setEditing(false)
    focusNodeWrapper()
  }, [id, clearEditNodeId, focusNodeWrapper])

  // Keep editNodeId until the user finishes editing — clearing it in this effect
  // breaks under StrictMode remount (dev / Playwright), which drops inline edit.
  useLayoutEffect(() => {
    if (editNodeId === id) {
      if (!editing) startEdit()
      return
    }
    if (editing) setEditing(false)
  }, [editNodeId, id, editing, startEdit])

  useLayoutEffect(() => {
    if (!editing || !selectAllOnFocus.current) return
    const input = inputRef.current
    if (!input) return
    const el = input
    let cancelled = false
    let attempts = 0
    const MAX_ATTEMPTS = 10
    // React Flow may steal focus to its pane during concurrent layout effects,
    // viewport animations (setCenter), or after a context-menu close. Retry
    // across frames until focus lands, the input is unmounted, or the limit is
    // reached.
    const tryFocus = () => {
      if (cancelled || !el.isConnected || attempts >= MAX_ATTEMPTS) {
        selectAllOnFocus.current = false
        return
      }
      attempts++
      el.focus()
      if (document.activeElement === el) {
        el.select()
        selectAllOnFocus.current = false
        return
      }
      requestAnimationFrame(tryFocus)
    }
    requestAnimationFrame(tryFocus)
    return () => {
      cancelled = true
    }
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

  const commit = useCallback(
    (val: string) => {
      const trimmed = val.trim()
      if (trimmed) updateNodeData(id, { text: trimmed })
      finishEdit()
    },
    [id, updateNodeData, finishEdit],
  )

  // Boolean selector: without it every node re-renders on each pointer move
  // while a connection gesture is in progress.
  const isConnectionTarget = useConnection(
    (c) => c.inProgress && c.toNode?.id === id && c.fromNode?.id !== id,
  )

  return (
    <div
      className="nesso-node"
      data-onboarding={
        isOnboardingStep(onboardingStep, 'concept-label') && id === firstNodeId
          ? 'concept-label'
          : isOnboardingStep(onboardingStep, 'second-concept-label') && id === secondNodeId
            ? 'second-concept-label'
            : isOnboardingStep(onboardingStep, 'connect-handle') && id === secondNodeId
              ? 'connect-target'
              : undefined
      }
      style={{ position: 'relative' }}
    >
      <ConceptNodeBody
        rootRef={rootRef}
        text={data.text}
        selected={selected}
        showHeatmap={showHeatmap}
        lastRating={data.lastRating ?? 0}
        cursor={editing ? 'text' : 'grab'}
        userSelect={editing ? 'text' : 'none'}
        connectionTarget={isConnectionTarget}
        onDoubleClick={(e) => {
          e.stopPropagation()
          requestEditNode(id)
        }}
      >
        <div style={{ position: 'relative' }}>
          <span
            className="nesso-node-label"
            style={{
              fontSize: '16px',
              fontWeight: 500,
              fontFamily: 'var(--font-display)',
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
                if (e.key === 'Enter') {
                  e.preventDefault()
                  skipBlurCommit.current = true
                  commit(e.currentTarget.value)
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  skipBlurCommit.current = true
                  setDraft(data.text)
                  finishEdit()
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
                fontSize: '16px',
                fontWeight: 500,
                fontFamily: 'var(--font-display)',
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
        data-onboarding={
          isOnboardingStep(onboardingStep, 'connect-handle') && id === firstNodeId
            ? 'connect-handle'
            : undefined
        }
        style={{
          width: 22,
          height: 22,
          background:
            'radial-gradient(circle, var(--accent) 2.5px, var(--bg-card, #fff) 2.5px 4px, transparent 4px)',
          border: 'none',
          borderRadius: 'var(--radius-circle)',
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
          borderRadius: 'var(--radius-circle)',
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
