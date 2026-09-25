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
import { edgeArcGeometry, flowNodeCenterY, PREVIEW_DASHARRAY } from './geometry.js'
import {
  closestCurveT,
  reconnectPreview,
  resolveLiveAnchor,
  type AnchorPoint,
  type DraggedPoint,
  type GestureBox,
  type ReconnectGesture,
  commitCurveDrag,
  dropReconnectDrag,
  moveCurveDrag,
  moveReconnectDrag,
  startCurveDrag,
  startReconnectDrag,
} from './edgeInteractions.js'

function categoryColor(
  cat: RelationCategory,
  mode: 'palette' | 'css',
  palette: NessoGraphDisplayContext['palette'],
): string {
  if (mode === 'css') return `var(--cat-${cat})`
  return PALETTES[palette][cat]
}

type NessoFlowEdge = Edge<NessoEdgeData, 'nesso'>

/** Curve-drag interaction state: the live anchor plus its gesture refs. */
function useCurveDragState() {
  const [dragAnchor, setDragAnchor] = useState<AnchorPoint | null>(null)
  const dragPointerId = useRef<number | null>(null)
  const dragMoved = useRef(false)
  const dragT = useRef<number | null>(null)
  const dragStartClient = useRef<{ x: number; y: number } | null>(null)
  function endCurveDrag() {
    dragPointerId.current = null
    dragT.current = null
    dragStartClient.current = null
  }
  return {
    dragAnchor,
    setDragAnchor,
    dragPointerId,
    dragMoved,
    dragT,
    dragStartClient,
    endCurveDrag,
  }
}

/** Endpoint-reconnect interaction state: drag snapshot plus hover tracking. */
function useReconnectDragState() {
  const [reconnectDrag, setReconnectDrag] = useState<DraggedPoint | null>(null)
  const reconnectPointerId = useRef<number | null>(null)
  // Concept boxes snapshotted at reconnect start for the cursor hit test
  // (pointer capture retargets elementFromPoint, so geometry is used instead).
  const reconnectNodes = useRef<(GestureBox & { id: string })[]>([])
  // Last notified hover target, to only emit on change.
  const reconnectOverRef = useRef<string | null>(null)
  function endReconnectDrag() {
    reconnectPointerId.current = null
    reconnectNodes.current = []
    setReconnectDrag(null)
  }
  return {
    reconnectDrag,
    setReconnectDrag,
    reconnectPointerId,
    reconnectNodes,
    reconnectOverRef,
    endReconnectDrag,
  }
}

/** Flow boxes of the edge endpoints from measured node sizes. */
function edgeBoxes(
  sourceNode: { internals: { positionAbsolute: { x: number } }; measured?: { width?: number } } & {
    measured?: { height?: number }
  },
  targetNode: { internals: { positionAbsolute: { x: number } }; measured?: { width?: number } } & {
    measured?: { height?: number }
  },
  sourceCenterY: number,
  targetCenterY: number,
) {
  const sw = sourceNode.measured?.width ?? 80
  const sh = sourceNode.measured?.height ?? 32
  const tw = targetNode.measured?.width ?? 80
  const th = targetNode.measured?.height ?? 32
  return {
    sourceBox: {
      cx: sourceNode.internals.positionAbsolute.x + sw / 2,
      cy: sourceCenterY,
      w: sw,
      h: sh,
    },
    targetBox: {
      cx: targetNode.internals.positionAbsolute.x + tw / 2,
      cy: targetCenterY,
      w: tw,
      h: th,
    },
  }
}

export function NessoEdge({ id, source, target, data, selected }: EdgeProps<NessoFlowEdge>) {
  const [hovered, setHovered] = useState(false)
  const [hoveredReconnectDot, setHoveredReconnectDot] = useState<'source' | 'target' | null>(null)
  // In-flight reshape anchor (flow coordinates). Committed once per gesture
  // on pointer-up through onEdgeCurveAnchorChange; the persisted
  // data.curveAnchor then drives rendering until the next gesture.
  const {
    dragAnchor,
    setDragAnchor,
    dragPointerId,
    dragMoved,
    dragT,
    dragStartClient,
    endCurveDrag,
  } = useCurveDragState()
  // Endpoint retargeting in flight: the dragged dot follows the cursor while
  // a dashed copy of the prospective edge shows its final geometry. overNodeId
  // tracks the concept under the cursor for the snapped preview.
  const {
    reconnectDrag,
    setReconnectDrag,
    reconnectPointerId,
    reconnectNodes,
    reconnectOverRef,
    endReconnectDrag: resetReconnectDrag,
  } = useReconnectDragState()
  const { screenToFlowPosition, getNodes, getEdges } = useReactFlow()
  const {
    edgeEncoding,
    curveStyle,
    palette,
    categoryColorMode,
    getRelationLabel,
    isItemSelected,
    selectedNodeId,
    selectedEdge,
    dimUnconnectedOnSelect,
    onEdgeCurveAnchorChange,
    onEdgeReconnect,
    onEdgeReconnectOver,
    onEdgeReconnectStart,
  } = useGraphDisplay()

  const sourceNode = useStore((s) => s.nodeLookup.get(source))
  const targetNode = useStore((s) => s.nodeLookup.get(target))

  const edgeType = asRelationTypeName(data?.type)
  const T = RELATION_TYPES[edgeType]
  const color =
    edgeEncoding === 'minimal' ? 'var(--ink-3)' : categoryColor(T.cat, categoryColorMode, palette)
  const isSelected = selected || isItemSelected?.('edge', id) === true
  const isConnected = isEdgeConnectedToNode(source, target, selectedNodeId)
  // A relation selection focuses the map like a concept selection: the
  // selected arc and its endpoints keep their look, the rest dims.
  const inFocus = selectedEdge ? selectedEdge.id === id : isConnected
  const hasSelection = dimUnconnectedOnSelect && Boolean(selectedNodeId || selectedEdge)
  const showLabel =
    edgeEncoding === 'full' || (edgeEncoding !== 'minimal' && (hovered || isSelected))
  const straight = curveStyle === 'straight'
  const label = getRelationLabel?.(edgeType) ?? T.label

  if (!sourceNode || !targetNode) return null

  const { sourceBox, targetBox } = edgeBoxes(
    sourceNode,
    targetNode,
    flowNodeCenterY(sourceNode),
    flowNodeCenterY(targetNode),
  )
  const siblingIdx = data?.siblingIdx ?? 0
  const storedOffset = data?.curveOffset ?? 1
  const liveAnchor = resolveLiveAnchor(data?.curveAnchor, sourceBox, dragAnchor)
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
    ? reconnectPreview({
        drag: reconnectDrag,
        source,
        target,
        sourceBox,
        targetBox,
        straight,
        storedOffset,
        siblingIdx,
        liveAnchor,
        originalGeometry: arc,
        sourceAttachment: data?.sourceAttachment,
        targetAttachment: data?.targetAttachment,
        siblingIdxAfter: siblingIdxAfterReconnect,
        nodeAt,
      })
    : null

  const {
    width: w,
    opacity: op,
    dimmed,
  } = resolveEdgeVisual({
    isSelected,
    hovered,
    inFocus,
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
    return closestCurveT(ra, arc.cpx, arc.cpy, rb, p)
  }

  function notifyReconnectOver(nodeId: string | null) {
    if (reconnectOverRef.current === nodeId) return
    reconnectOverRef.current = nodeId
    onEdgeReconnectOver?.(nodeId)
  }

  function endReconnectDrag() {
    resetReconnectDrag()
    notifyReconnectOver(null)
  }

  // Hovered concept for a reconnect side, excluding the fixed end itself
  // (a drop there would self-loop, mirroring creation's fromNode guard).
  function overNodeId(side: 'source' | 'target', p: { x: number; y: number }): string | null {
    const fixedId = side === 'target' ? source : target
    const over = nodeAt(p)
    return over && over.id !== fixedId ? over.id : null
  }

  // Gesture contexts for the extracted pointer handlers: plain objects
  // rebuilt per render, so they always close over the current geometry.
  const curve = {
    id,
    sourceBox,
    canCurve,
    flowPointAt,
    closestT,
    dragPointerId,
    dragMoved,
    dragT,
    dragStartClient,
    setDragAnchor,
    onEdgeCurveAnchorChange,
    endCurveDrag,
  }
  const reconnect = {
    id,
    source,
    target,
    sourceBox,
    targetBox,
    liveAnchor,
    sourceAttachment: data?.sourceAttachment,
    targetAttachment: data?.targetAttachment,
    reconnectable,
    reconnectPointerId,
    reconnectNodes,
    reconnectDrag,
    snapshotNodes: () =>
      getNodes().map((n) => {
        const w = n.measured?.width ?? 80
        const h = n.measured?.height ?? 32
        return { id: n.id, cx: n.position.x + w / 2, cy: n.position.y + h / 2, w, h }
      }),
    flowPointAt,
    nodeAt,
    overNodeId,
    notifyReconnectOver,
    setReconnectDrag,
    setDragAnchor,
    onReconnectStart: onEdgeReconnectStart,
    onEdgeReconnect,
    siblingIdxAfter: siblingIdxAfterReconnect,
    endReconnectDrag,
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
        onPointerDown={(e) => startCurveDrag(e, curve)}
        onPointerMove={(e) => moveCurveDrag(e, curve)}
        onPointerUp={(e) => commitCurveDrag(e, curve)}
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

      <NessoEdgeStroke preview={preview} path={path} color={color} width={w} opacity={op} />

      <NessoEdgeArrow
        visible={reconnectDrag === null && T.inverse !== 'self' && edgeEncoding !== 'minimal'}
        tip={rb}
        angle={arrowAngle}
        color={color}
        opacity={dimmed ? op : 0.85}
      />

      <NessoEdgeLabel
        visible={showLabel}
        x={preview?.labelX ?? labelX}
        y={preview?.labelY ?? labelY}
        label={label}
        color={color}
        opacity={dimmed ? op : 1}
      />

      {showDots && (
        <NessoEdgeDots
          id={id}
          ra={ra}
          rb={rb}
          preview={preview}
          reconnectDrag={reconnectDrag}
          hoveredReconnectDot={hoveredReconnectDot}
          setHoveredReconnectDot={setHoveredReconnectDot}
          reconnect={reconnect}
        />
      )}
    </g>
  )
}

/** The visible stroke: the dashed reconnect preview, or the committed arc. */
function NessoEdgeStroke({
  preview,
  path,
  color,
  width,
  opacity,
}: {
  preview: { path: string; snapped: boolean } | null
  path: string
  color: string
  width: number
  opacity: number
}) {
  if (preview)
    return (
      <path
        d={preview.path}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeDasharray={PREVIEW_DASHARRAY}
        opacity={preview.snapped ? 0.65 : 0.25}
        strokeLinecap="round"
        style={{ pointerEvents: 'none' }}
      />
    )
  return (
    <path
      d={path}
      fill="none"
      stroke={color}
      strokeWidth={width}
      opacity={opacity}
      strokeLinecap="round"
      style={{ pointerEvents: 'none' }}
    />
  )
}

/** Direction arrowhead at the target end, hidden for symmetric relations. */
function NessoEdgeArrow({
  visible,
  tip,
  angle,
  color,
  opacity,
}: {
  visible: boolean
  tip: { x: number; y: number }
  angle: number
  color: string
  opacity: number
}) {
  if (!visible) return null
  const arrowSize = 7
  const a1 = angle + Math.PI - 0.45
  const a2 = angle + Math.PI + 0.45
  const ax1 = tip.x + Math.cos(a1) * arrowSize
  const ay1 = tip.y + Math.sin(a1) * arrowSize
  const ax2 = tip.x + Math.cos(a2) * arrowSize
  const ay2 = tip.y + Math.sin(a2) * arrowSize
  return (
    <polygon
      points={`${tip.x},${tip.y} ${ax1},${ay1} ${ax2},${ay2}`}
      fill={color}
      opacity={opacity}
      style={{ pointerEvents: 'none' }}
    />
  )
}

/** Relation label chip at the arc midpoint. */
function NessoEdgeLabel({
  visible,
  x,
  y,
  label,
  color,
  opacity,
}: {
  visible: boolean
  x: number
  y: number
  label: string
  color: string
  opacity: number
}) {
  if (!visible) return null
  return (
    <foreignObject
      x={x - 60}
      y={y - 10}
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
        <span style={{ opacity }}>{label}</span>
      </div>
    </foreignObject>
  )
}

/** Endpoint-reconnect dots: hover-only handles that retarget the edge ends. */
function NessoEdgeDots({
  id,
  ra,
  rb,
  preview,
  reconnectDrag,
  hoveredReconnectDot,
  setHoveredReconnectDot,
  reconnect,
}: {
  id: string
  ra: { x: number; y: number }
  rb: { x: number; y: number }
  preview: { a: { x: number; y: number }; b: { x: number; y: number } } | null
  reconnectDrag: DraggedPoint | null
  hoveredReconnectDot: 'source' | 'target' | null
  setHoveredReconnectDot: (side: 'source' | 'target' | null) => void
  reconnect: ReconnectGesture
}) {
  return (
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
                onPointerDown={(e) => startReconnectDrag(e, side, reconnect)}
                onPointerMove={(e) => moveReconnectDrag(e, side, reconnect)}
                onPointerUp={(e) => dropReconnectDrag(e, reconnect)}
                onPointerCancel={() => {
                  reconnect.endReconnectDrag()
                }}
              />
            </EdgeEndpointDot>
          )
        })}
    </g>
  )
}
