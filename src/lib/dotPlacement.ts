// SPDX-License-Identifier: MIT
import { edgeArcGeometry, pointFromBox } from '@nesso-how/graph'

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
 * bottom-left. Two are enough: both taken at once is vanishingly rare, and
 * keeping the dot on the left side stays visually calm.
 */
export function dotCorners(box: DotBox): { left: number; top: number }[] {
  return [
    { left: 0, top: 0 },
    { left: 0, top: box.h },
  ]
}

/** Minimum flow-px distance between the dot corner and an arc endpoint. */
export const DOT_CORNER_CLEARANCE = 20

/** Finite number field with fallback (rejects missing, non-numeric, NaN). */
export function numberField(
  data: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
): number {
  const value = data?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function finitePoint(value: unknown): { x: number; y: number } | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { x, y } = value as { x?: unknown; y?: unknown }
  return Number.isFinite(x) && Number.isFinite(y) ? { x: x as number, y: y as number } : undefined
}

/** Border attachment `{x, y}` or undefined for missing/malformed values. */
export function pointField(
  data: Record<string, unknown> | undefined,
  key: string,
): { x: number; y: number } | undefined {
  return finitePoint(data?.[key])
}

/** Saved reshape anchor or undefined for missing/malformed values. */
export function anchorField(
  data: Record<string, unknown> | undefined,
): { x: number; y: number; t: number } | undefined {
  const value = data?.['curveAnchor']
  if (typeof value !== 'object' || value === null) return undefined
  const { t } = value as { t?: unknown }
  const point = finitePoint(value)
  return point && Number.isFinite(t) ? { ...point, t: t as number } : undefined
}

function toBox(snapshot: DotSnapshot | undefined, fallback: DotBox): DotBox {
  return {
    x: snapshot?.position?.x ?? fallback.x,
    y: snapshot?.position?.y ?? fallback.y,
    w: snapshot?.measured?.width ?? fallback.w,
    h: snapshot?.measured?.height ?? fallback.h,
  }
}

function geoBox(box: DotBox): { cx: number; cy: number; w: number; h: number } {
  return { cx: box.x + box.w / 2, cy: box.y + box.h / 2, w: box.w, h: box.h }
}

/**
 * Flow point where `edge` ends on `nodeId`, via `edgeArcGeometry` with the
 * same params the renderer uses — or undefined when the edge is unrelated
 * or its other end is unknown.
 */
export function incidentEndpoint(
  edge: DotEdge,
  nodeId: string,
  myBox: DotBox,
  boxOf: (id: string) => DotBox | undefined,
  straight: boolean,
): { x: number; y: number } | undefined {
  if (edge.source !== nodeId && edge.target !== nodeId) return undefined
  const fromSource = edge.source === nodeId
  const other = boxOf(fromSource ? edge.target : edge.source)
  if (!other) return undefined
  // The stored anchor is normalized to the source box (see display.ts);
  // the renderer converts it via pointFromBox before solving the arc.
  const storedAnchor = anchorField(edge.data)
  const sourceBox = fromSource ? myBox : other
  const geo = edgeArcGeometry(geoBox(sourceBox), geoBox(fromSource ? other : myBox), {
    straight,
    curveOffset: numberField(edge.data, 'curveOffset', 1),
    siblingIdx: numberField(edge.data, 'siblingIdx', 0),
    anchor: storedAnchor
      ? { ...pointFromBox(geoBox(sourceBox), storedAnchor), t: storedAnchor.t }
      : undefined,
    sourceAttachment: pointField(edge.data, 'sourceAttachment'),
    targetAttachment: pointField(edge.data, 'targetAttachment'),
  })
  return fromSource ? geo.a : geo.b
}

/** First corner no endpoint comes closer to than the clearance. */
export function firstFreeCorner(
  box: DotBox,
  ends: { x: number; y: number }[],
): { left: number; top: number } {
  const corners = dotCorners(box)
  return (
    corners.find((corner) =>
      ends.every(
        (end) =>
          Math.hypot(end.x - (box.x + corner.left), end.y - (box.y + corner.top)) >=
          DOT_CORNER_CLEARANCE,
      ),
    ) ?? corners[0]
  )
}

const FALLBACK_BOX: DotBox = { x: 0, y: 0, w: 80, h: 32 }

/**
 * Corner for the node's hover dot: the first candidate no attached arc ends
 * on, falling back to the primary top-left when both corners are taken.
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
  const myBox = toBox(mine, FALLBACK_BOX)
  const straight = curveStyle === 'straight'
  const boxOf = (id: string) => {
    const snapshot = snapshotOf(id)
    return snapshot ? toBox(snapshot, FALLBACK_BOX) : undefined
  }
  const ends: { x: number; y: number }[] = []
  for (const edge of edges) {
    const end = incidentEndpoint(edge, nodeId, myBox, boxOf, straight)
    if (end) ends.push(end)
  }
  return firstFreeCorner(myBox, ends)
}
