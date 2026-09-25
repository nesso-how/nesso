// SPDX-License-Identifier: MIT
import { edgeArcGeometry } from '@nesso-how/graph'

/** Flow box of a concept. */
export interface DotBox {
  x: number
  y: number
  w: number
  h: number
}

/** Minimal node snapshot (React Flow `getNode` result shape). */
export interface DotSnapshot {
  position?: { x: number; y: number }
  measured?: { width?: number; height?: number }
}

/** Minimal edge shape: endpoints plus the curve fields edge rendering reads. */
export interface DotEdge {
  source: string
  target: string
  data?: Record<string, unknown>
}

/**
 * Corner candidates for the hover dot, in order: top-left (primary),
 * bottom-left, top-right, bottom-right — as offsets from the node origin.
 */
export function dotCorners(box: DotBox): { left: number; top: number }[] {
  return [
    { left: 0, top: 0 },
    { left: 0, top: box.h },
    { left: box.w, top: 0 },
    { left: box.w, top: box.h },
  ]
}

/** Minimum flow-px distance between the dot corner and an arc endpoint. */
export const DOT_CORNER_CLEARANCE = 20

function numberField(
  data: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
): number {
  const value = data?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function pointField(
  data: Record<string, unknown> | undefined,
  key: string,
): { x: number; y: number } | undefined {
  const value = data?.[key]
  if (typeof value !== 'object' || value === null) return undefined
  const { x, y } = value as { x?: unknown; y?: unknown }
  return typeof x === 'number' && typeof y === 'number' ? { x, y } : undefined
}

function anchorField(
  data: Record<string, unknown> | undefined,
): { x: number; y: number; t: number } | undefined {
  const value = data?.['curveAnchor']
  if (typeof value !== 'object' || value === null) return undefined
  const { x, y, t } = value as { x?: unknown; y?: unknown; t?: unknown }
  return typeof x === 'number' && typeof y === 'number' && typeof t === 'number'
    ? { x, y, t }
    : undefined
}

function toBox(snapshot: DotSnapshot | undefined, fallback: DotBox): DotBox {
  return {
    x: snapshot?.position?.x ?? fallback.x,
    y: snapshot?.position?.y ?? fallback.y,
    w: snapshot?.measured?.width ?? fallback.w,
    h: snapshot?.measured?.height ?? fallback.h,
  }
}

/**
 * Corner for the node's hover dot: the first candidate no attached arc ends
 * on, falling back to the primary top-left when every corner is taken.
 * Endpoints reuse `edgeArcGeometry`, so they always match the rendered arcs.
 * Pure and unit-tested; the hook only applies the result to the DOM.
 */
export function hoverDotCorner(
  nodeId: string,
  mine: DotSnapshot | undefined,
  edges: DotEdge[],
  snapshotOf: (id: string) => DotSnapshot | undefined,
  curveStyle: string,
): { left: number; top: number } {
  const myBox = toBox(mine, { x: 0, y: 0, w: 80, h: 32 })
  const straight = curveStyle === 'straight'
  const ends: { x: number; y: number }[] = []
  for (const edge of edges) {
    if (edge.source !== nodeId && edge.target !== nodeId) continue
    const side = edge.source === nodeId ? 'source' : 'target'
    const other = toBox(snapshotOf(edge.source === nodeId ? edge.target : edge.source), {
      x: 0,
      y: 0,
      w: 80,
      h: 32,
    })
    const sourceBox = side === 'source' ? myBox : other
    const targetBox = side === 'source' ? other : myBox
    const geo = edgeArcGeometry(
      {
        cx: sourceBox.x + sourceBox.w / 2,
        cy: sourceBox.y + sourceBox.h / 2,
        w: sourceBox.w,
        h: sourceBox.h,
      },
      {
        cx: targetBox.x + targetBox.w / 2,
        cy: targetBox.y + targetBox.h / 2,
        w: targetBox.w,
        h: targetBox.h,
      },
      {
        straight,
        curveOffset: numberField(edge.data, 'curveOffset', 1),
        siblingIdx: numberField(edge.data, 'siblingIdx', 0),
        anchor: anchorField(edge.data),
        sourceAttachment: pointField(edge.data, 'sourceAttachment'),
        targetAttachment: pointField(edge.data, 'targetAttachment'),
      },
    )
    ends.push(side === 'source' ? geo.a : geo.b)
  }
  const corners = dotCorners(myBox)
  return (
    corners.find((corner) =>
      ends.every(
        (end) =>
          Math.hypot(end.x - (myBox.x + corner.left), end.y - (myBox.y + corner.top)) >=
          DOT_CORNER_CLEARANCE,
      ),
    ) ?? corners[0]
  )
}
