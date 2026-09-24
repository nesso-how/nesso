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
  connectionPreview,
  curveOffsetForPointerAt,
  flowNodeCenterY,
  nessoArcPath,
  quadraticPoint,
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
  // Grab reference frozen at drag start: the trimmed endpoints slide as the
  // offset changes, so inverting against the live chord would chase a moving
  // target and make the arc jitter; the frozen chord + grab parameter keep
  // the mapping a pure function of the pointer for the whole gesture.
  const dragGrab = useRef<{
    ax: number
    ay: number
    bx: number
    by: number
    t: number
    siblingIdx: number
  } | null>(null)
  // Endpoint retargeting in flight: the dragged dot follows the cursor while
  // a creation-style preview arc runs from the fixed end. overNodeId tracks
  // the concept under the cursor for the snapped variant of the preview.
  const [reconnectDrag, setReconnectDrag] = useState<{
    side: 'source' | 'target'
    x: number
    y: number
    overNodeId: string | null
  } | null>(null)
  const reconnectPointerId = useRef<number | null>(null)
  // Concept boxes snapshotted at reconnect start for the cursor hit test
  // (pointer capture retargets elementFromPoint, so geometry is used instead).
  const reconnectNodes = useRef<{ id: string; cx: number; cy: number; w: number; h: number }[]>([])
  const { screenToFlowPosition, getNodes } = useReactFlow()
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
    onEdgeReconnect,
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
  function trimEndpoints(offset: number) {
    if (straight) {
      return {
        a: rectExit(scx, scy, sw + pad * 2, sh + pad * 2, tcx, tcy),
        b: rectExit(tcx, tcy, tw + pad * 2, th + pad * 2, scx, scy),
      }
    }
    const { cpx, cpy } = arcControlPoint(scx, scy, tcx, tcy, data?.siblingIdx ?? 0, offset)
    return {
      a: rectExit(scx, scy, sw + pad * 2, sh + pad * 2, cpx, cpy),
      b: rectExit(tcx, tcy, tw + pad * 2, th + pad * 2, cpx, cpy),
    }
  }
  const { a, b } = trimEndpoints(renderOffset)

  // Endpoints frozen for the drag duration: the live trim points slide as
  // the offset changes, so rendering against them would let the arc drift
  // off the cursor mid-gesture. Frozen ends keep B(t) exactly under the
  // pointer; the live trim resumes on release.
  const grabbing = dragGrab.current !== null && dragOffset !== null
  const ra = grabbing ? { x: dragGrab.current!.ax, y: dragGrab.current!.ay } : a
  const rb = grabbing ? { x: dragGrab.current!.bx, y: dragGrab.current!.by } : b

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

  const { path, labelX, labelY, arrowAngle } = nessoArcPath(
    ra.x,
    ra.y,
    rb.x,
    rb.y,
    data?.siblingIdx ?? 0,
    straight,
    renderOffset,
  )

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

  const editable = onEdgeCurveOffsetChange !== undefined
  const reconnectable = onEdgeReconnect !== undefined
  const canCurve = editable && !straight
  // Endpoint dots appear on hover/selection; while a reconnect is in flight
  // they stay mounted so pointer capture survives the re-renders.
  const showDots = reconnectable && (isSelected || hovered || reconnectDrag !== null)

  const siblingIdx = data?.siblingIdx ?? 0

  function flowPointAt(clientX: number, clientY: number): { x: number; y: number } {
    return screenToFlowPosition({ x: clientX, y: clientY })
  }

  // Curve parameter of the rendered arc closest to a flow point, sampled.
  function closestT(p: { x: number; y: number }): number {
    const { cpx, cpy } = arcControlPoint(a.x, a.y, b.x, b.y, siblingIdx, renderOffset)
    let best = 0.5
    let bestD = Number.POSITIVE_INFINITY
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      const q = quadraticPoint(a.x, a.y, cpx, cpy, b.x, b.y, t)
      const d = (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y)
      if (d < bestD) {
        bestD = d
        best = t
      }
    }
    return best
  }

  function offsetAtPoint(p: { x: number; y: number }): number {
    const g = dragGrab.current
    if (!g) return renderOffset
    return curveOffsetForPointerAt(
      p.x,
      p.y,
      g.ax,
      g.ay,
      g.bx,
      g.by,
      g.t,
      g.siblingIdx,
      renderOffset,
    )
  }

  function endCurveDrag() {
    dragPointerId.current = null
    dragGrab.current = null
    setDragOffset(null)
  }

  // Solve the offset against the LIVE trim so the committed curve passes
  // through the release point: the frozen trim holds the arc steady during
  // the gesture, but the live trim slides with the offset — committing the
  // preview value as-is would make the arc visibly jump on release.
  function solveReleaseOffset(p: { x: number; y: number }): number {
    const g = dragGrab.current
    if (!g) return renderOffset
    let s = offsetAtPoint(p)
    for (let i = 0; i < 10; i++) {
      const { a: la, b: lb } = trimEndpoints(s)
      const next = curveOffsetForPointerAt(p.x, p.y, la.x, la.y, lb.x, lb.y, g.t, g.siblingIdx, s)
      if (!Number.isFinite(next)) break
      if (Math.abs(next - s) < 0.001) {
        s = next
        break
      }
      s = next
    }
    return s
  }

  function endReconnectDrag() {
    reconnectPointerId.current = null
    reconnectNodes.current = []
    setReconnectDrag(null)
  }

  return (
    <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <path
        d={path}
        stroke="transparent"
        strokeWidth={14}
        fill="none"
        style={{
          cursor: canCurve ? (dragOffset !== null ? 'grabbing' : 'grab') : undefined,
          pointerEvents: 'all',
          touchAction: 'none',
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || !canCurve || dragPointerId.current !== null) return
          const p = flowPointAt(e.clientX, e.clientY)
          const t = closestT(p)
          // The grab must sit on the middle of the arc: near the ends a drag
          // would be ambiguous with the reconnect dots, so let it be a click.
          if (t < 0.12 || t > 0.88) return
          // Keep the gesture on the arc: React Flow must not start a pane
          // pan from these events.
          e.stopPropagation()
          e.currentTarget.setPointerCapture(e.pointerId)
          dragPointerId.current = e.pointerId
          dragMoved.current = false
          dragGrab.current = { ax: a.x, ay: a.y, bx: b.x, by: b.y, t, siblingIdx }
          // Snap the arc onto the cursor from the grab moment: the hit area
          // is wider than the visible stroke, so the offsets could otherwise
          // start a few pixels off and keep that bias for the whole gesture.
          setDragOffset(offsetAtPoint(p))
        }}
        onPointerMove={(e) => {
          if (dragPointerId.current !== e.pointerId) return
          dragMoved.current = true
          setDragOffset(offsetAtPoint(flowPointAt(e.clientX, e.clientY)))
        }}
        onPointerUp={(e) => {
          if (dragPointerId.current !== e.pointerId) return
          const moved = dragMoved.current
          const final = moved ? solveReleaseOffset(flowPointAt(e.clientX, e.clientY)) : undefined
          endCurveDrag()
          // A plain click only previews; the store (and its history) sees
          // one commit per real drag.
          if (final !== undefined) onEdgeCurveOffsetChange?.(id, final)
        }}
        onPointerCancel={() => {
          endCurveDrag()
        }}
        onDoubleClick={(e) => {
          if (!canCurve) return
          e.stopPropagation()
          endCurveDrag()
          onEdgeCurveOffsetChange?.(id, undefined)
        }}
      />

      {reconnectDrag !== null ? (
        (() => {
          // Creation-identical preview: default bow, accent dashed stroke,
          // faint while free and stronger when snapped onto a concept.
          const fixedNode = reconnectDrag.side === 'target' ? sourceNode : targetNode
          const fw = fixedNode.measured?.width ?? 80
          const fh = fixedNode.measured?.height ?? 32
          const overBox = reconnectDrag.overNodeId ? (nodeAt(reconnectDrag) ?? null) : null
          const { path: previewPath, snapped } = connectionPreview(
            fixedNode.internals.positionAbsolute.x + fw / 2,
            flowNodeCenterY(fixedNode),
            fw,
            fh,
            reconnectDrag.x,
            reconnectDrag.y,
            overBox,
            straight,
          )
          return (
            <path
              d={previewPath}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.5}
              strokeDasharray={'0.5 3'}
              opacity={snapped ? 0.65 : 0.25}
              strokeLinecap="round"
              style={{ pointerEvents: 'none' }}
            />
          )
        })()
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
          x={labelX - 60}
          y={labelY - 10}
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
          {(['source', 'target'] as const).map((side) => {
            const cx =
              reconnectDrag?.side === side ? reconnectDrag.x : side === 'source' ? ra.x : rb.x
            const cy =
              reconnectDrag?.side === side ? reconnectDrag.y : side === 'source' ? ra.y : rb.y
            const fixed = reconnectDrag !== null && reconnectDrag.side !== side
            return (
              <circle
                key={side}
                cx={cx}
                cy={cy}
                r={6}
                fill="var(--paper)"
                stroke="var(--accent)"
                strokeWidth={1.5}
                data-testid={`reconnect-${side}-${id}`}
                style={{
                  cursor: fixed ? undefined : 'crosshair',
                  pointerEvents: fixed ? 'none' : 'all',
                  touchAction: 'none',
                }}
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
                  setReconnectDrag({ side, x: p.x, y: p.y, overNodeId: nodeAt(p)?.id ?? null })
                }}
                onPointerMove={(e) => {
                  if (reconnectPointerId.current !== e.pointerId) return
                  const p = flowPointAt(e.clientX, e.clientY)
                  setReconnectDrag({ side, x: p.x, y: p.y, overNodeId: nodeAt(p)?.id ?? null })
                }}
                onPointerUp={(e) => {
                  if (reconnectPointerId.current !== e.pointerId) return
                  reconnectPointerId.current = null
                  // Geometric drop lookup: pointer capture retargets
                  // elementFromPoint, so the snapshot is used instead.
                  const drop = nodeAt(flowPointAt(e.clientX, e.clientY))?.id ?? null
                  const drag = reconnectDrag
                  endReconnectDrag()
                  if (drag && drop) onEdgeReconnect?.(id, drag.side, drop)
                }}
                onPointerCancel={() => {
                  endReconnectDrag()
                }}
              />
            )
          })}
        </g>
      )}
    </g>
  )
}
