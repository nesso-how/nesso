// SPDX-License-Identifier: MIT
import { useRef, useState } from 'react'
import type { Edge, EdgeProps } from '@xyflow/react'
import { useReactFlow, useStore } from '@xyflow/react'
import { PALETTES, RELATION_TYPES, asRelationTypeName } from '@nesso-how/vocab-learning'
import type { RelationCategory } from '@nesso-how/vocab-learning'
import type { NessoEdgeData } from './display.js'
import { useGraphDisplay, type NessoGraphDisplayContext } from './context.js'
import { isEdgeConnectedToNode, resolveEdgeVisual } from './edgeHighlight.js'
import { EdgeEndpointDot } from './EdgeEndpointDot.js'
import {
  attachmentAt,
  edgeArcGeometry,
  flowNodeCenterY,
  pointFromBox,
  pointRelativeToBox,
  quadraticPoint,
  rebaseArcAnchor,
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
  const [hoveredReconnectDot, setHoveredReconnectDot] = useState<'source' | 'target' | null>(null)
  // In-flight reshape anchor (flow coordinates). Committed once per gesture
  // on pointer-up through onEdgeCurveAnchorChange; the persisted
  // data.curveAnchor then drives rendering until the next gesture.
  const [dragAnchor, setDragAnchor] = useState<{ x: number; y: number; t: number } | null>(null)
  const dragPointerId = useRef<number | null>(null)
  const dragMoved = useRef(false)
  const dragT = useRef<number | null>(null)
  const dragStartClient = useRef<{ x: number; y: number } | null>(null)
  // Endpoint retargeting in flight: the dragged dot follows the cursor while
  // a dashed copy of the prospective edge shows its final geometry. overNodeId
  // tracks the concept under the cursor for the snapped preview.
  const [reconnectDrag, setReconnectDrag] = useState<{
    side: 'source' | 'target'
    x: number
    y: number
    startX: number
    startY: number
    overNodeId: string | null
  } | null>(null)
  const reconnectPointerId = useRef<number | null>(null)
  // Concept boxes snapshotted at reconnect start for the cursor hit test
  // (pointer capture retargets elementFromPoint, so geometry is used instead).
  const reconnectNodes = useRef<{ id: string; cx: number; cy: number; w: number; h: number }[]>([])
  const { screenToFlowPosition, getNodes, getEdges } = useReactFlow()
  const {
    edgeEncoding,
    curveStyle,
    palette,
    categoryColorMode,
    getRelationLabel,
    isItemSelected,
    selectedNodeId,
    dimUnconnectedOnSelect,
    onEdgeCurveAnchorChange,
    onEdgeReconnect,
    onEdgeReconnectOver,
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

  const sourceBox = { cx: scx, cy: scy, w: sw, h: sh }
  const targetBox = { cx: tcx, cy: tcy, w: tw, h: th }
  const siblingIdx = data?.siblingIdx ?? 0
  // The committed anchor is stored relative to the source node's padded box,
  // so the curve follows the node; the live drag anchor is flow-absolute.
  const persistedAnchor = data?.curveAnchor
    ? { ...pointFromBox(sourceBox, data.curveAnchor), t: data.curveAnchor.t }
    : null
  const liveAnchor = dragAnchor ?? persistedAnchor
  const arc = edgeArcGeometry(sourceBox, targetBox, {
    straight,
    curveOffset: storedOffset,
    siblingIdx,
    anchor: liveAnchor ?? undefined,
    sourceAttachment: data?.sourceAttachment,
    targetAttachment: data?.targetAttachment,
  })
  const { a: ra, b: rb, path, labelX, labelY, arrowAngle } = arc

  // Concept under a flow point, from the reconnect-start snapshot.
  function nodeAt(p: {
    x: number
    y: number
  }): { id: string; cx: number; cy: number; w: number; h: number } | null {
    return (
      reconnectNodes.current.find(
        (n) => Math.abs(p.x - n.cx) <= n.w / 2 && Math.abs(p.y - n.cy) <= n.h / 2,
      ) ?? null
    )
  }

  // styleEdges assigns the sibling index in edge order for each unordered
  // node pair. A new endpoint can move the edge into a different fan.
  function siblingIdxAfterReconnect(nextSource: string, nextTarget: string): number {
    let index = 0
    for (const edge of getEdges()) {
      if (edge.id === id) break
      if (
        (edge.source === nextSource && edge.target === nextTarget) ||
        (edge.source === nextTarget && edge.target === nextSource)
      )
        index++
    }
    return index
  }

  const preview = reconnectDrag
    ? (() => {
        const overBox = reconnectDrag.overNodeId ? nodeAt(reconnectDrag) : null
        const endBox = overBox ?? { cx: reconnectDrag.x, cy: reconnectDrag.y, w: 0, h: 0 }
        const nextSource = reconnectDrag.side === 'source' ? endBox : sourceBox
        const nextTarget = reconnectDrag.side === 'target' ? endBox : targetBox
        const nextSiblingIdx = overBox
          ? siblingIdxAfterReconnect(
              reconnectDrag.side === 'source' ? overBox.id : source,
              reconnectDrag.side === 'target' ? overBox.id : target,
            )
          : siblingIdx
        const movingAttachment = overBox ? attachmentAt(overBox, reconnectDrag) : undefined
        const options = {
          straight,
          curveOffset: storedOffset,
          siblingIdx: nextSiblingIdx,
          anchor: liveAnchor
            ? rebaseArcAnchor(liveAnchor, sourceBox, targetBox, nextSource, nextTarget)
            : undefined,
          freeEnd: overBox ? undefined : reconnectDrag.side,
          sourceAttachment:
            reconnectDrag.side === 'source' ? movingAttachment : data?.sourceAttachment,
          targetAttachment:
            reconnectDrag.side === 'target' ? movingAttachment : data?.targetAttachment,
        }
        const geometry = edgeArcGeometry(nextSource, nextTarget, options)
        if (overBox) return { ...geometry, snapped: true }

        // The click can land anywhere in the dot's 22px hit area, not just
        // at the rendered endpoint. Starting from that cursor position would
        // recompute the bow and make the preview jump on pointerdown. Blend
        // away only that initial discrepancy while dragging in free space;
        // snapped previews still use the exact prospective edge geometry.
        const startBox = { cx: reconnectDrag.startX, cy: reconnectDrag.startY, w: 0, h: 0 }
        const startGeometry = edgeArcGeometry(
          reconnectDrag.side === 'source' ? startBox : sourceBox,
          reconnectDrag.side === 'target' ? startBox : targetBox,
          {
            ...options,
            anchor: liveAnchor
              ? rebaseArcAnchor(
                  liveAnchor,
                  sourceBox,
                  targetBox,
                  reconnectDrag.side === 'source' ? startBox : sourceBox,
                  reconnectDrag.side === 'target' ? startBox : targetBox,
                )
              : undefined,
          },
        )
        const traveled = Math.hypot(
          reconnectDrag.x - reconnectDrag.startX,
          reconnectDrag.y - reconnectDrag.startY,
        )
        const ratio = Math.min(traveled / 80, 1)
        const correction = 1 - ratio * ratio * (3 - 2 * ratio)
        const a = {
          x: geometry.a.x + (ra.x - startGeometry.a.x) * correction,
          y: geometry.a.y + (ra.y - startGeometry.a.y) * correction,
        }
        const b = {
          x: geometry.b.x + (rb.x - startGeometry.b.x) * correction,
          y: geometry.b.y + (rb.y - startGeometry.b.y) * correction,
        }
        const cpx = geometry.cpx + (arc.cpx - startGeometry.cpx) * correction
        const cpy = geometry.cpy + (arc.cpy - startGeometry.cpy) * correction
        const path = straight
          ? `M ${a.x} ${a.y} L ${b.x} ${b.y}`
          : `M ${a.x} ${a.y} Q ${cpx} ${cpy} ${b.x} ${b.y}`
        return {
          ...geometry,
          a,
          b,
          path,
          labelX: straight ? (a.x + b.x) / 2 : (a.x + 2 * cpx + b.x) / 4,
          labelY: straight ? (a.y + b.y) / 2 : (a.y + 2 * cpy + b.y) / 4,
          snapped: false,
        }
      })()
    : null

  const arrowSize = 7
  const a1 = arrowAngle + Math.PI - 0.45
  const a2 = arrowAngle + Math.PI + 0.45
  const ax1 = rb.x + Math.cos(a1) * arrowSize
  const ay1 = rb.y + Math.sin(a1) * arrowSize
  const ax2 = rb.x + Math.cos(a2) * arrowSize
  const ay2 = rb.y + Math.sin(a2) * arrowSize

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

  const editable = onEdgeCurveAnchorChange !== undefined
  const reconnectable = onEdgeReconnect !== undefined
  const canCurve = editable && !straight
  // Both dots appear on hover, never on selection alone. During reconnect
  // the captured dot stays mounted but invisible until the gesture ends.
  const showDots = reconnectable && (hovered || reconnectDrag !== null)

  function flowPointAt(clientX: number, clientY: number): { x: number; y: number } {
    return screenToFlowPosition({ x: clientX, y: clientY })
  }

  // Curve parameter of the rendered arc closest to a flow point, sampled.
  function closestT(p: { x: number; y: number }): number {
    let best = 0.5
    let bestD = Number.POSITIVE_INFINITY
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      const q = quadraticPoint(ra.x, ra.y, arc.cpx, arc.cpy, rb.x, rb.y, t)
      const d = (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y)
      if (d < bestD) {
        bestD = d
        best = t
      }
    }
    return best
  }

  function endCurveDrag() {
    dragPointerId.current = null
    dragT.current = null
    dragStartClient.current = null
  }

  function endReconnectDrag() {
    reconnectPointerId.current = null
    reconnectNodes.current = []
    setReconnectDrag(null)
    notifyReconnectOver(null)
  }

  // Last notified hover target, to only emit on change.
  const reconnectOverRef = useRef<string | null>(null)

  function notifyReconnectOver(nodeId: string | null) {
    if (reconnectOverRef.current === nodeId) return
    reconnectOverRef.current = nodeId
    onEdgeReconnectOver?.(nodeId)
  }

  // Hovered concept for a reconnect side, excluding the fixed end itself
  // (a drop there would self-loop, mirroring creation's fromNode guard).
  function overNodeId(side: 'source' | 'target', p: { x: number; y: number }): string | null {
    const fixedId = side === 'target' ? source : target
    const over = nodeAt(p)
    return over && over.id !== fixedId ? over.id : null
  }

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false)
        setHoveredReconnectDot(null)
      }}
    >
      <path
        d={path}
        stroke="transparent"
        strokeWidth={14}
        fill="none"
        style={{
          cursor: canCurve ? (dragPointerId.current !== null ? 'grabbing' : 'grab') : undefined,
          pointerEvents: 'all',
          touchAction: 'none',
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || !canCurve || dragPointerId.current !== null) return
          const p = flowPointAt(e.clientX, e.clientY)
          const t = closestT(p)
          // The reconnect dots own the endpoints; every other part of the
          // stroke can be grabbed. Avoid the Bézier singularity at t=0/1.
          if (t < 0.02 || t > 0.98) return
          // Keep the gesture on the arc: React Flow must not start a pane
          // pan from these events.
          e.stopPropagation()
          e.currentTarget.setPointerCapture(e.pointerId)
          dragPointerId.current = e.pointerId
          dragMoved.current = false
          dragT.current = t
          dragStartClient.current = { x: e.clientX, y: e.clientY }
          // Do not touch the curve on a click; wait for a real drag.
        }}
        onPointerMove={(e) => {
          if (dragPointerId.current !== e.pointerId) return
          const start = dragStartClient.current
          if (
            !dragMoved.current &&
            start &&
            Math.hypot(e.clientX - start.x, e.clientY - start.y) < 4
          )
            return
          dragMoved.current = true
          const t = dragT.current
          if (t !== null) setDragAnchor({ ...flowPointAt(e.clientX, e.clientY), t })
        }}
        onPointerUp={(e) => {
          if (dragPointerId.current !== e.pointerId) return
          // A release without a real drag is a click: leave the curve alone.
          if (dragT.current !== null && dragMoved.current) {
            const p = flowPointAt(e.clientX, e.clientY)
            // One history entry per gesture: the store commit replaces the
            // local anchor as the source of truth for the rendered shape.
            // Raw normalization — the grabbed point is NOT on the node border.
            onEdgeCurveAnchorChange?.(id, { ...pointRelativeToBox(sourceBox, p), t: dragT.current })
            setDragAnchor(null)
          }
          endCurveDrag()
        }}
        onPointerCancel={() => {
          // The committed shape lives in the store; dropping the live anchor
          // restores it.
          setDragAnchor(null)
          endCurveDrag()
        }}
        onDoubleClick={(e) => {
          if (!canCurve) return
          e.stopPropagation()
          endCurveDrag()
          setDragAnchor(null)
          onEdgeCurveAnchorChange?.(id, undefined)
        }}
      />

      {preview ? (
        <path
          d={preview.path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeDasharray={'0.5 3'}
          opacity={preview.snapped ? 0.65 : 0.25}
          strokeLinecap="round"
          style={{ pointerEvents: 'none' }}
        />
      ) : (
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={w}
          opacity={op}
          strokeLinecap="round"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {reconnectDrag === null && T.inverse !== 'self' && edgeEncoding !== 'minimal' && (
        <polygon
          points={`${rb.x},${rb.y} ${ax1},${ay1} ${ax2},${ay2}`}
          fill={color}
          opacity={dimmed ? op : 0.85}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {showLabel && (
        <foreignObject
          x={(preview?.labelX ?? labelX) - 60}
          y={(preview?.labelY ?? labelY) - 10}
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

      {showDots && (
        <g>
          {(['source', 'target'] as const)
            .filter((side) => reconnectDrag === null || reconnectDrag.side === side)
            .map((side) => {
              // Captured pointer events keep arriving even when the dragged
              // dot snaps away from the cursor onto the concept border.
              const endpoint = side === 'source' ? (preview?.a ?? ra) : (preview?.b ?? rb)
              const { x: cx, y: cy } = endpoint
              return (
                <EdgeEndpointDot
                  key={side}
                  x={cx}
                  y={cy}
                  active={hoveredReconnectDot === side}
                  hidden={reconnectDrag !== null}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={11}
                    fill="transparent"
                    data-testid={`reconnect-${side}-${id}`}
                    style={{
                      cursor: 'crosshair',
                      pointerEvents: 'all',
                      touchAction: 'none',
                    }}
                    onPointerEnter={() => setHoveredReconnectDot(side)}
                    onPointerLeave={() => setHoveredReconnectDot(null)}
                    onPointerDown={(e) => {
                      if (e.button !== 0 || !reconnectable || reconnectPointerId.current !== null)
                        return
                      e.stopPropagation()
                      e.currentTarget.setPointerCapture(e.pointerId)
                      reconnectPointerId.current = e.pointerId
                      // Public node positions (Nesso concepts are flat, so
                      // position is flow-absolute); no store subscription needed.
                      reconnectNodes.current = getNodes().map((n) => {
                        const w = n.measured?.width ?? 80
                        const h = n.measured?.height ?? 32
                        return {
                          id: n.id,
                          cx: n.position.x + w / 2,
                          cy: n.position.y + h / 2,
                          w,
                          h,
                        }
                      })
                      const p = flowPointAt(e.clientX, e.clientY)
                      const over = overNodeId(side, p)
                      notifyReconnectOver(over)
                      setReconnectDrag({
                        side,
                        x: p.x,
                        y: p.y,
                        startX: p.x,
                        startY: p.y,
                        overNodeId: over,
                      })
                    }}
                    onPointerMove={(e) => {
                      if (reconnectPointerId.current !== e.pointerId) return
                      const p = flowPointAt(e.clientX, e.clientY)
                      const over = overNodeId(side, p)
                      notifyReconnectOver(over)
                      setReconnectDrag(
                        (current) =>
                          current && {
                            ...current,
                            x: p.x,
                            y: p.y,
                            overNodeId: over,
                          },
                      )
                    }}
                    onPointerUp={(e) => {
                      if (reconnectPointerId.current !== e.pointerId) return
                      reconnectPointerId.current = null
                      // Geometric drop lookup: pointer capture retargets
                      // elementFromPoint, so the snapshot is used instead.
                      const drop = nodeAt(flowPointAt(e.clientX, e.clientY)) ?? null
                      const drag = reconnectDrag
                      endReconnectDrag()
                      if (drag && drop) {
                        const fixedId = drag.side === 'source' ? target : source
                        // Re-base a reshaped curve onto the prospective chord
                        // and commit it in the same transaction as the move,
                        // so one undo step covers the whole gesture.
                        const nextSource = drag.side === 'source' ? drop : sourceBox
                        const nextTarget = drag.side === 'target' ? drop : targetBox
                        const rebased =
                          liveAnchor && drop.id !== fixedId
                            ? rebaseArcAnchor(
                                liveAnchor,
                                sourceBox,
                                targetBox,
                                nextSource,
                                nextTarget,
                              )
                            : null
                        setDragAnchor(null)
                        onEdgeReconnect?.(
                          id,
                          drag.side,
                          drop.id,
                          attachmentAt(drop, flowPointAt(e.clientX, e.clientY)),
                          rebased
                            ? { ...pointRelativeToBox(nextSource, rebased), t: rebased.t }
                            : undefined,
                        )
                      }
                    }}
                    onPointerCancel={() => {
                      endReconnectDrag()
                    }}
                  />
                </EdgeEndpointDot>
              )
            })}
        </g>
      )}
    </g>
  )
}
