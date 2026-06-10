// SPDX-License-Identifier: MIT
// Shared path math for Nesso edges — adapted from src/geometry/nessoEdgeGeometry.ts.

export function defaultCurveFlip(
  sourceCenterX: number,
  sourceCenterY: number,
  targetCenterX: number,
  targetCenterY: number,
): boolean {
  const targetAbove = targetCenterY < sourceCenterY
  const targetLeft = targetCenterX < sourceCenterX
  return targetAbove !== targetLeft
}

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

export function flowNodeCenterX(node: {
  internals: { positionAbsolute: { x: number } }
  measured?: { width?: number }
}): number {
  const w = node.measured?.width ?? 80
  return node.internals.positionAbsolute.x + w / 2
}

export function flowNodeCenterY(node: {
  internals: { positionAbsolute: { y: number } }
  measured?: { height?: number }
}): number {
  const h = node.measured?.height ?? 32
  return node.internals.positionAbsolute.y + h / 2
}

export function effectiveCurveFlip(
  auto: boolean,
  pinned: boolean | undefined,
  storedFlip: boolean | undefined,
  sourceCenterX: number,
  sourceCenterY: number,
  targetCenterX: number,
  targetCenterY: number,
): boolean {
  if (auto && !pinned)
    return defaultCurveFlip(sourceCenterX, sourceCenterY, targetCenterX, targetCenterY)
  return Boolean(storedFlip)
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

/** Quadratic-curve control point shared by edge rendering and the connection line. */
export function arcControlPoint(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  siblingIdx = 0,
  curveFlip = false,
): { cpx: number; cpy: number } {
  const dx = tx - sx
  const dy = ty - sy
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const nx = -dy / dist
  const ny = dx / dist
  const off = siblingIdx * 14
  const sign = curveFlip ? -1 : 1
  const bend = (Math.min(dist * 0.22, 90) + off * 0.5) * sign
  return { cpx: (sx + tx) / 2 + nx * bend, cpy: (sy + ty) / 2 + ny * bend }
}

export function nessoArcPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  siblingIdx = 0,
  straight = false,
  curveFlip = false,
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

  const { cpx, cpy } = arcControlPoint(sx, sy, tx, ty, siblingIdx, curveFlip)

  const path = `M ${sx} ${sy} Q ${cpx} ${cpy} ${tx} ${ty}`
  const labelX = cpx * 0.5 + (sx + tx) * 0.25
  const labelY = cpy * 0.5 + (sy + ty) * 0.25
  const arrowAngle = Math.atan2(ty - cpy, tx - cpx)

  return { path, labelX, labelY, arrowAngle }
}
