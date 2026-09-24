// SPDX-License-Identifier: MIT
import { useRef, useState } from 'react'
import type { Edge, EdgeProps } from '@xyflow/react'
import { useReactFlow, useStore } from '@xyflow/react'
import { PALETTES, RELATION_TYPES, asRelationTypeName } from '@nesso-how/vocab-learning'
import type { RelationCategory } from '@nesso-how/vocab-learning'
import type { NessoEdgeData } from './display.js'
import { useGraphDisplay, type NessoGraphDisplayContext } from './context.js'
import { isEdgeConnectedToNode, resolveEdgeVisual } from './edgeHighlight.js'
import {
  arcControlPoint,
  curveOffsetForPointer,
  flowNodeCenterY,
  nessoArcPath,
  rectExit,
} from './geometry.js'

function categoryColor(
  cat: RelationCategory,
  mode: 'palette' | 'css',
  palette: NessoGraphDisplayContext['palette'],
): string {
  if (mode === 'css') return `var(--cat-${cat})`
  return PALETTES[palette][cat]
}

type NessoFlowEdge = Edge<NessoEdgeData, 'nesso'>

export function NessoEdge({ id, source, target, data, selected }: EdgeProps<NessoFlowEdge>) {
  const [hovered, setHovered] = useState(false)
  // Live preview offset while a curve drag is in flight; committed to the
  // store once per gesture on pointer-up, so undo sees a single entry.
  const [dragOffset, setDragOffset] = useState<number | null>(null)
  const dragPointerId = useRef<number | null>(null)
  const dragMoved = useRef(false)
  const { screenToFlowPosition } = useReactFlow()
  const {
    edgeEncoding,
    curveStyle,
    palette,
    categoryColorMode,
    getRelationLabel,
    isItemSelected,
    selectedNodeId,
    dimUnconnectedOnSelect,
    onEdgeCurveOffsetChange,
  } = useGraphDisplay()

  const sourceNode = useStore((s) => s.nodeLookup.get(source))
  const targetNode = useStore((s) => s.nodeLookup.get(target))

  const edgeType = asRelationTypeName(data?.type)
  const T = RELATION_TYPES[edgeType]
  const color =
    edgeEncoding === 'minimal' ? 'var(--ink-3)' : categoryColor(T.cat, categoryColorMode, palette)
  const isSelected = selected || isItemSelected?.('edge', id) === true
  const isConnected = isEdgeConnectedToNode(source, target, selectedNodeId)
  const hasSelection = dimUnconnectedOnSelect && selectedNodeId != null && selectedNodeId !== ''
  const showLabel =
    edgeEncoding === 'full' || (edgeEncoding !== 'minimal' && (hovered || isSelected))
  const straight = curveStyle === 'straight'
  const label = getRelationLabel?.(edgeType) ?? T.label

  if (!sourceNode || !targetNode) return null

  const sw = sourceNode.measured?.width ?? 80
  const sh = sourceNode.measured?.height ?? 32
  const tw = targetNode.measured?.width ?? 80
  const th = targetNode.measured?.height ?? 32

  const scx = sourceNode.internals.positionAbsolute.x + sw / 2
  const scy = flowNodeCenterY(sourceNode)
  const tcx = targetNode.internals.positionAbsolute.x + tw / 2
  const tcy = flowNodeCenterY(targetNode)

  const storedOffset = data?.curveOffset ?? 1
  const renderOffset = dragOffset ?? storedOffset

  const pad = 6
  const { a, b } = (() => {
    if (straight) {
      return {
        a: rectExit(scx, scy, sw + pad * 2, sh + pad * 2, tcx, tcy),
        b: rectExit(tcx, tcy, tw + pad * 2, th + pad * 2, scx, scy),
      }
    }
    const { cpx, cpy } = arcControlPoint(scx, scy, tcx, tcy, data?.siblingIdx ?? 0, renderOffset)
    return {
      a: rectExit(scx, scy, sw + pad * 2, sh + pad * 2, cpx, cpy),
      b: rectExit(tcx, tcy, tw + pad * 2, th + pad * 2, cpx, cpy),
    }
  })()

  const { path, labelX, labelY, arrowAngle } = nessoArcPath(
    a.x,
    a.y,
    b.x,
    b.y,
    data?.siblingIdx ?? 0,
    straight,
    renderOffset,
  )

  const arrowSize = 7
  const a1 = arrowAngle + Math.PI - 0.45
  const a2 = arrowAngle + Math.PI + 0.45
  const ax1 = b.x + Math.cos(a1) * arrowSize
  const ay1 = b.y + Math.sin(a1) * arrowSize
  const ax2 = b.x + Math.cos(a2) * arrowSize
  const ay2 = b.y + Math.sin(a2) * arrowSize

  const {
    width: w,
    opacity: op,
    dimmed,
  } = resolveEdgeVisual({
    isSelected,
    hovered,
    isConnected,
    hasSelection,
  })

  const editable = onEdgeCurveOffsetChange !== undefined
  const showHandle = editable && !straight && (isSelected || hovered)

  // Unit normal of the chord (same convention as arcControlPoint): the label
  // chip is nudged along it while the handle is visible so the handle can sit
  // exactly on the curve apex without covering the text.
  const chordDx = b.x - a.x
  const chordDy = b.y - a.y
  const chordLen = Math.sqrt(chordDx * chordDx + chordDy * chordDy) || 1
  const nx = -chordDy / chordLen
  const ny = chordDx / chordLen
  const textX = showHandle ? labelX + nx * 14 : labelX
  const textY = showHandle ? labelY + ny * 14 : labelY

  function offsetAt(clientX: number, clientY: number): number {
    const p = screenToFlowPosition({ x: clientX, y: clientY })
    return curveOffsetForPointer(p.x, p.y, a.x, a.y, b.x, b.y, renderOffset)
  }

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: 'default' }}
    >
      <path d={path} stroke="transparent" strokeWidth={14} fill="none" />

      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={w}
        opacity={op}
        strokeLinecap="round"
      />

      {T.inverse !== 'self' && edgeEncoding !== 'minimal' && (
        <polygon
          points={`${b.x},${b.y} ${ax1},${ay1} ${ax2},${ay2}`}
          fill={color}
          opacity={dimmed ? op : 0.85}
        />
      )}

      {showLabel && (
        <foreignObject
          x={textX - 60}
          y={textY - 10}
          width={120}
          height={20}
          style={{ overflow: 'visible', pointerEvents: 'none' }}
        >
          <div
            style={{
              display: 'inline-block',
              background: 'var(--paper)',
              border: '0.5px solid var(--line)',
              borderRadius: 4,
              padding: '1px 6px',
              font: "500 10px 'JetBrains Mono', ui-monospace",
              color,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
              lineHeight: '16px',
            }}
          >
            <span style={{ opacity: dimmed ? op : 1 }}>{label}</span>
          </div>
        </foreignObject>
      )}

      {showHandle && (
        <g>
          <circle
            cx={labelX}
            cy={labelY}
            r={7}
            fill="var(--paper)"
            stroke="var(--accent)"
            strokeWidth={1.5}
            data-testid={`curve-handle-${id}`}
            style={{
              cursor: dragOffset !== null ? 'grabbing' : 'grab',
              pointerEvents: 'all',
              touchAction: 'none',
            }}
            onPointerDown={(e) => {
              if (e.button !== 0 || dragPointerId.current !== null) return
              // Keep the gesture on the handle: React Flow must not start a
              // pane pan or node drag from these events.
              e.stopPropagation()
              e.currentTarget.setPointerCapture(e.pointerId)
              dragPointerId.current = e.pointerId
              dragMoved.current = false
              setDragOffset(offsetAt(e.clientX, e.clientY))
            }}
            onPointerMove={(e) => {
              if (dragPointerId.current !== e.pointerId) return
              dragMoved.current = true
              setDragOffset(offsetAt(e.clientX, e.clientY))
            }}
            onPointerUp={(e) => {
              if (dragPointerId.current !== e.pointerId) return
              dragPointerId.current = null
              const moved = dragMoved.current
              setDragOffset(null)
              // A plain click only previews; the store (and its history)
              // sees one commit per real drag.
              if (moved) onEdgeCurveOffsetChange?.(id, offsetAt(e.clientX, e.clientY))
            }}
            onPointerCancel={() => {
              dragPointerId.current = null
              setDragOffset(null)
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              dragPointerId.current = null
              setDragOffset(null)
              onEdgeCurveOffsetChange?.(id, undefined)
            }}
          />
          <circle
            cx={labelX}
            cy={labelY}
            r={2}
            fill="var(--accent)"
            style={{ pointerEvents: 'none' }}
          />
        </g>
      )}
    </g>
  )
}
