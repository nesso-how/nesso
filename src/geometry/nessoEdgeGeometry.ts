// SPDX-License-Identifier: MIT
// Shared path math for Nesso edges and the in-progress connection preview.

export function rectExit(cx: number, cy: number, w: number, h: number, tx: number, ty: number) {
  const dx = tx - cx, dy = ty - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const hx = w / 2, hy = h / 2
  const sx = dx === 0 ? Infinity : hx / Math.abs(dx)
  const sy = dy === 0 ? Infinity : hy / Math.abs(dy)
  const s = Math.min(sx, sy)
  return { x: cx + dx * s, y: cy + dy * s }
}

export function nessoArcPath(
  sx: number, sy: number,
  tx: number, ty: number,
  siblingIdx = 0,
  straight = false,
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

  const dx = tx - sx
  const dy = ty - sy
  const dist = Math.sqrt(dx * dx + dy * dy) || 1

  const nx = -dy / dist
  const ny = dx / dist

  const off = siblingIdx * 14
  const bend = Math.min(dist * 0.22, 90) + off * 0.5
  const cpx = (sx + tx) / 2 + nx * bend
  const cpy = (sy + ty) / 2 + ny * bend

  const path = `M ${sx} ${sy} Q ${cpx} ${cpy} ${tx} ${ty}`

  const labelX = cpx * 0.5 + (sx + tx) * 0.25
  const labelY = cpy * 0.5 + (sy + ty) * 0.25

  const arrowAngle = Math.atan2(ty - cpy, tx - cpx)

  return { path, labelX, labelY, arrowAngle }
}
