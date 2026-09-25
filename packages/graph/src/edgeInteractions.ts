// SPDX-License-Identifier: MIT
/** Mutable ref as returned by useRef (React 19 types keep RefObject.current readonly). */
interface MutableRef<T> {
  current: T
}
import type { Dispatch, SetStateAction, PointerEvent as ReactPointerEvent } from 'react'
import type { EndpointAttachment } from './geometry.js'
import {
  attachmentAt,
  edgeArcGeometry,
  pointRelativeToBox,
  quadraticPoint,
  rebaseArcAnchor,
} from './geometry.js'

export interface GestureBox {
  cx: number
  cy: number
  w: number
  h: number
}

export interface DraggedPoint {
  side: 'source' | 'target'
  x: number
  y: number
  startX: number
  startY: number
  overNodeId: string | null
}

export interface AnchorPoint {
  x: number
  y: number
  t: number
}

interface Geometry {
  a: { x: number; y: number }
  b: { x: number; y: number }
  cpx: number
  cpy: number
  path: string
  labelX: number
  labelY: number
  arrowAngle: number
}

export interface ReconnectPreviewInput {
  drag: DraggedPoint
  source: string
  target: string
  sourceBox: GestureBox
  targetBox: GestureBox
  straight: boolean
  storedOffset: number
  siblingIdx: number
  liveAnchor: AnchorPoint | null
  /** The committed arc's geometry: the shape the free drag blends away from. */
  originalGeometry: Geometry
  sourceAttachment?: EndpointAttachment
  targetAttachment?: EndpointAttachment
  /** Same ordering rule as styleEdges, applied to the prospective pair. */
  siblingIdxAfter(nextSource: string, nextTarget: string): number
  nodeAt(p: { x: number; y: number }): (GestureBox & { id: string }) | null
}

function reconnectOptions(
  drag: DraggedPoint,
  overBox: (GestureBox & { id: string }) | null,
  nextSiblingIdx: number,
  input: ReconnectPreviewInput,
  nextSource: GestureBox,
  nextTarget: GestureBox,
) {
  const movingAttachment = overBox ? attachmentAt(overBox, drag) : undefined
  return {
    straight: input.straight,
    curveOffset: input.storedOffset,
    siblingIdx: nextSiblingIdx,
    anchor: input.liveAnchor
      ? rebaseArcAnchor(input.liveAnchor, input.sourceBox, input.targetBox, nextSource, nextTarget)
      : undefined,
    freeEnd: overBox ? undefined : drag.side,
    sourceAttachment: drag.side === 'source' ? movingAttachment : input.sourceAttachment,
    targetAttachment: drag.side === 'target' ? movingAttachment : input.targetAttachment,
  }
}

/**
 * The click can land anywhere in the dot's 22px hit area, not just at the
 * rendered endpoint. Starting from that cursor position would recompute the
 * bow and make the preview jump on pointerdown. Blend away only that initial
 * discrepancy while dragging in free space; snapped previews still use the
 * exact prospective edge geometry.
 */
function blendFreePreview(
  drag: DraggedPoint,
  geometry: Geometry,
  startGeometry: Geometry,
  original: Geometry,
  straight: boolean,
): Geometry {
  const traveled = Math.hypot(drag.x - drag.startX, drag.y - drag.startY)
  const ratio = Math.min(traveled / 80, 1)
  const correction = 1 - ratio * ratio * (3 - 2 * ratio)
  const a = {
    x: geometry.a.x + (original.a.x - startGeometry.a.x) * correction,
    y: geometry.a.y + (original.a.y - startGeometry.a.y) * correction,
  }
  const b = {
    x: geometry.b.x + (original.b.x - startGeometry.b.x) * correction,
    y: geometry.b.y + (original.b.y - startGeometry.b.y) * correction,
  }
  const cpx = geometry.cpx + (original.cpx - startGeometry.cpx) * correction
  const cpy = geometry.cpy + (original.cpy - startGeometry.cpy) * correction
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
  }
}

/** The dashed arc that previews where the edge will land, snapped or free. */
export function reconnectPreview(input: ReconnectPreviewInput) {
  const { drag } = input
  const overBox = drag.overNodeId ? input.nodeAt(drag) : null
  const endBox: GestureBox = overBox ?? { cx: drag.x, cy: drag.y, w: 0, h: 0 }
  const nextSource = drag.side === 'source' ? endBox : input.sourceBox
  const nextTarget = drag.side === 'target' ? endBox : input.targetBox
  const nextSiblingIdx = overBox
    ? input.siblingIdxAfter(...siblingPair(drag, input, overBox.id))
    : input.siblingIdx
  const options = reconnectOptions(drag, overBox, nextSiblingIdx, input, nextSource, nextTarget)
  const geometry = edgeArcGeometry(nextSource, nextTarget, options)
  if (overBox) return { ...geometry, snapped: true }

  const startBox = { cx: drag.startX, cy: drag.startY, w: 0, h: 0 }
  const startGeometry = edgeArcGeometry(
    drag.side === 'source' ? startBox : input.sourceBox,
    drag.side === 'target' ? startBox : input.targetBox,
    { ...options, anchor: startAnchorFor(input, drag, startBox) },
  )
  return {
    ...blendFreePreview(drag, geometry, startGeometry, input.originalGeometry, input.straight),
    snapped: false,
  }
}

/** Ids of the prospective node pair, in sibling-fan order. */
function siblingPair(
  drag: DraggedPoint,
  input: ReconnectPreviewInput,
  overId: string,
): [string, string] {
  return [
    drag.side === 'source' ? overId : input.source,
    drag.side === 'target' ? overId : input.target,
  ]
}

/** The live anchor re-based onto the chord the drag started from. */
function startAnchorFor(input: ReconnectPreviewInput, drag: DraggedPoint, startBox: GestureBox) {
  if (!input.liveAnchor) return undefined
  return rebaseArcAnchor(
    input.liveAnchor,
    input.sourceBox,
    input.targetBox,
    drag.side === 'source' ? startBox : input.sourceBox,
    drag.side === 'target' ? startBox : input.targetBox,
  )
}
/** Curve parameter of a quadratic arc closest to a flow point, sampled. */
export function closestCurveT(
  ra: { x: number; y: number },
  cpx: number,
  cpy: number,
  rb: { x: number; y: number },
  p: { x: number; y: number },
): number {
  let best = 0.5
  let bestD = Number.POSITIVE_INFINITY
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    const q = quadraticPoint(ra.x, ra.y, cpx, cpy, rb.x, rb.y, t)
    const d = (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y)
    if (d < bestD) {
      bestD = d
      best = t
    }
  }
  return best
}

/** Everything a curve-drag handler needs from the live edge. */
export interface CurveGesture {
  id: string
  sourceBox: GestureBox
  canCurve: boolean
  flowPointAt(clientX: number, clientY: number): { x: number; y: number }
  closestT(p: { x: number; y: number }): number
  dragPointerId: MutableRef<number | null>
  dragMoved: MutableRef<boolean>
  dragT: MutableRef<number | null>
  dragStartClient: MutableRef<{ x: number; y: number } | null>
  setDragAnchor(anchor: AnchorPoint | null): void
  onEdgeCurveAnchorChange?: (id: string, anchor?: AnchorPoint) => void
  endCurveDrag(): void
}
export function startCurveDrag(e: ReactPointerEvent<SVGPathElement>, g: CurveGesture): void {
  if (e.button !== 0 || !g.canCurve || g.dragPointerId.current !== null) return
  const t = g.closestT(g.flowPointAt(e.clientX, e.clientY))
  // The reconnect dots own the endpoints; every other part of the stroke can
  // be grabbed. Avoid the Bézier singularity at t=0/1.
  if (t < 0.02 || t > 0.98) return
  // Keep the gesture on the arc: React Flow must not start a pane pan.
  e.stopPropagation()
  e.currentTarget.setPointerCapture(e.pointerId)
  g.dragPointerId.current = e.pointerId
  g.dragMoved.current = false
  g.dragT.current = t
  g.dragStartClient.current = { x: e.clientX, y: e.clientY }
  // Do not touch the curve on a click; wait for a real drag.
}

export function moveCurveDrag(e: ReactPointerEvent<SVGPathElement>, g: CurveGesture): void {
  if (g.dragPointerId.current !== e.pointerId) return
  const start = g.dragStartClient.current
  if (!g.dragMoved.current && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 4)
    return
  g.dragMoved.current = true
  if (g.dragT.current !== null)
    g.setDragAnchor({ ...g.flowPointAt(e.clientX, e.clientY), t: g.dragT.current })
}

export function commitCurveDrag(e: ReactPointerEvent<SVGPathElement>, g: CurveGesture): void {
  if (g.dragPointerId.current !== e.pointerId) return
  // A release without a real drag is a click: leave the curve alone.
  if (g.dragT.current !== null && g.dragMoved.current) {
    const p = g.flowPointAt(e.clientX, e.clientY)
    // One history entry per gesture: the store commit replaces the local
    // anchor as the source of truth for the rendered shape. Raw
    // normalization — the grabbed point is NOT on the node border.
    g.onEdgeCurveAnchorChange?.(g.id, { ...pointRelativeToBox(g.sourceBox, p), t: g.dragT.current })
    g.setDragAnchor(null)
  }
  g.endCurveDrag()
}

/** Everything an endpoint-reconnect gesture needs from the live edge. */
export interface ReconnectGesture {
  id: string
  source: string
  target: string
  sourceBox: GestureBox
  targetBox: GestureBox
  liveAnchor: AnchorPoint | null
  sourceAttachment?: EndpointAttachment
  targetAttachment?: EndpointAttachment
  reconnectable: boolean
  reconnectPointerId: MutableRef<number | null>
  reconnectNodes: MutableRef<(GestureBox & { id: string })[]>
  reconnectDrag: DraggedPoint | null
  snapshotNodes(): (GestureBox & { id: string })[]
  flowPointAt(clientX: number, clientY: number): { x: number; y: number }
  nodeAt(p: { x: number; y: number }): (GestureBox & { id: string }) | null
  overNodeId(side: 'source' | 'target', p: { x: number; y: number }): string | null
  notifyReconnectOver(nodeId: string | null): void
  setReconnectDrag: Dispatch<SetStateAction<DraggedPoint | null>>
  setDragAnchor(anchor: AnchorPoint | null): void
  onEdgeReconnect?: (
    id: string,
    side: 'source' | 'target',
    nodeId: string,
    attachment?: EndpointAttachment,
    curveAnchor?: AnchorPoint,
  ) => void
  siblingIdxAfter(nextSource: string, nextTarget: string): number
  endReconnectDrag(): void
}

export function startReconnectDrag(
  e: ReactPointerEvent<SVGCircleElement>,
  side: 'source' | 'target',
  g: ReconnectGesture,
): void {
  if (e.button !== 0 || !g.reconnectable || g.reconnectPointerId.current !== null) return
  e.stopPropagation()
  e.currentTarget.setPointerCapture(e.pointerId)
  g.reconnectPointerId.current = e.pointerId
  // Public node positions (Nesso concepts are flat, so position is
  // flow-absolute); no store subscription needed.
  g.reconnectNodes.current = g.snapshotNodes()
  const p = g.flowPointAt(e.clientX, e.clientY)
  const over = g.overNodeId(side, p)
  g.notifyReconnectOver(over)
  g.setReconnectDrag({ side, x: p.x, y: p.y, startX: p.x, startY: p.y, overNodeId: over })
}

export function moveReconnectDrag(
  e: ReactPointerEvent<SVGCircleElement>,
  side: 'source' | 'target',
  g: ReconnectGesture,
): void {
  if (g.reconnectPointerId.current !== e.pointerId) return
  const p = g.flowPointAt(e.clientX, e.clientY)
  const over = g.overNodeId(side, p)
  g.notifyReconnectOver(over)
  g.setReconnectDrag((current) => current && { ...current, x: p.x, y: p.y, overNodeId: over })
}

export function dropReconnectDrag(
  e: ReactPointerEvent<SVGCircleElement>,
  g: ReconnectGesture,
): void {
  if (g.reconnectPointerId.current !== e.pointerId) return
  g.reconnectPointerId.current = null
  // Geometric drop lookup: pointer capture retargets elementFromPoint, so
  // the snapshot is used instead.
  const drop = g.nodeAt(g.flowPointAt(e.clientX, e.clientY))
  const drag = g.reconnectDrag
  g.endReconnectDrag()
  if (!drag || !drop) return
  const fixedId = drag.side === 'source' ? g.target : g.source
  const nextSource = drag.side === 'source' ? drop : g.sourceBox
  const nextTarget = drag.side === 'target' ? drop : g.targetBox
  // Re-base a reshaped curve onto the prospective chord and commit it in the
  // same transaction as the move, so one undo step covers the whole gesture.
  const rebased =
    g.liveAnchor && drop.id !== fixedId
      ? rebaseArcAnchor(g.liveAnchor, g.sourceBox, g.targetBox, nextSource, nextTarget)
      : null
  g.setDragAnchor(null)
  g.onEdgeReconnect?.(
    g.id,
    drag.side,
    drop.id,
    attachmentAt(drop, g.flowPointAt(e.clientX, e.clientY)),
    rebased ? { ...pointRelativeToBox(nextSource, rebased), t: rebased.t } : undefined,
  )
}
