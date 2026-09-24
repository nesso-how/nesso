// SPDX-License-Identifier: MIT
// Shared path math for Nesso edges — adapted from src/geometry/nessoEdgeGeometry.ts.

export function nodeCenterX(node: {
  position: { x: number }
  measured?: { width?: number }
}): number {
  const w = node.measured?.width ?? 80
  return node.position.x + w / 2
}

export function nodeCenterY(node: {
  position: { y: number }
  measured?: { height?: number }
}): number {
  const h = node.measured?.height ?? 32
  return node.position.y + h / 2
}

export function flowNodeCenterY(node: {
  internals: { positionAbsolute: { y: number } }
  measured?: { height?: number }
}): number {
  const h = node.measured?.height ?? 32
  return node.internals.positionAbsolute.y + h / 2
}

export function rectExit(cx: number, cy: number, w: number, h: number, tx: number, ty: number) {
  const dx = tx - cx,
    dy = ty - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const hx = w / 2,
    hy = h / 2
  const sx = dx === 0 ? Infinity : hx / Math.abs(dx)
  const sy = dy === 0 ? Infinity : hy / Math.abs(dy)
  const s = Math.min(sx, sy)
  return { x: cx + dx * s, y: cy + dy * s }
}

/**
 * Clamp window for user-dragged curve offsets. |offset| = 1 is the default
 * bow; 3 keeps extreme drags from folding the arc back across its nodes.
 */
export const CURVE_OFFSET_LIMIT = 3

export function clampCurveOffset(offset: number): number {
  if (!Number.isFinite(offset)) return 1
  return Math.min(CURVE_OFFSET_LIMIT, Math.max(-CURVE_OFFSET_LIMIT, offset))
}

/**
 * Inverse of the arc bow for pointer dragging: given a pointer position in
 * flow coordinates and the edge chord, return the signed offset that would
 * place the curve apex under the pointer. The apex sits halfway between chord
 * and control point, hence the factor of 2. A pointer on the chord flattens
 * the arc (0); far pointers clamp to the limit window.
 */
export function curveOffsetForPointer(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  fallback = 1,
): number {
  const dx = bx - ax
  const dy = by - ay
  const dist = Math.sqrt(dx * dx + dy * dy)
  const defaultBend = Math.min(dist * 0.22, 90)
  if (!(defaultBend > 0)) return fallback
  const nx = -dy / dist
  const ny = dx / dist
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  return clampCurveOffset((2 * ((px - mx) * nx + (py - my) * ny)) / defaultBend)
}

/** Quadratic-curve control point shared by edge rendering and the connection line. */
export function arcControlPoint(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  siblingIdx = 0,
  curveOffset = 1,
): { cpx: number; cpy: number } {
  const dx = tx - sx
  const dy = ty - sy
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const nx = -dy / dist
  const ny = dx / dist
  // Bow magnitude scales with the signed offset; the sibling fan-out stays
  // additive so parallel edges keep separating even on flattened arcs.
  const bend = Math.min(dist * 0.22, 90) * clampCurveOffset(curveOffset) + siblingIdx * 7
  return { cpx: (sx + tx) / 2 + nx * bend, cpy: (sy + ty) / 2 + ny * bend }
}

export function nessoArcPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  siblingIdx = 0,
  straight = false,
  curveOffset = 1,
): { path: string; labelX: number; labelY: number; arrowAngle: number } {
  if (straight) {
    const lx = (sx + tx) / 2
    const ly = (sy + ty) / 2
    return {
      path: `M ${sx} ${sy} L ${tx} ${ty}`,
      labelX: lx,
      labelY: ly,
      arrowAngle: Math.atan2(ty - sy, tx - sx),
    }
  }

  const { cpx, cpy } = arcControlPoint(sx, sy, tx, ty, siblingIdx, curveOffset)

  const path = `M ${sx} ${sy} Q ${cpx} ${cpy} ${tx} ${ty}`
  const labelX = cpx * 0.5 + (sx + tx) * 0.25
  const labelY = cpy * 0.5 + (sy + ty) * 0.25
  const arrowAngle = Math.atan2(ty - cpy, tx - cpx)

  return { path, labelX, labelY, arrowAngle }
}
