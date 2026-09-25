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

/** Point on the quadratic Bézier (a, c, b) at parameter t. */
export function quadraticPoint(
  ax: number,
  ay: number,
  cpx: number,
  cpy: number,
  bx: number,
  by: number,
  t: number,
): { x: number; y: number } {
  const u = 1 - t
  return {
    x: u * u * ax + 2 * u * t * cpx + t * t * bx,
    y: u * u * ay + 2 * u * t * cpy + t * t * by,
  }
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

/** Trim margin around node boxes shared by edge rendering and previews. */
export const NODE_PAD = 6

/**
 * Dash pattern of the connect/reconnect preview arc. It matches the CSS
 * `1px dashed` destination ring on concepts (screenshot-verified in Chromium),
 * so the dragged arc and its destination highlight read as one gesture.
 */
export const PREVIEW_DASHARRAY = '3 2'

export interface EndpointAttachment {
  /** Coordinates normalized to the node box plus NODE_PAD, relative to its centre. */
  x: number
  y: number
}

/** Project a cursor point onto the rounded (pill-shaped) attachment border. */
export function closestPillBorder(
  node: { cx: number; cy: number; w: number; h: number },
  point: { x: number; y: number },
): { x: number; y: number } {
  const hx = node.w / 2 + NODE_PAD
  const hy = node.h / 2 + NODE_PAD
  const horizontal = hx >= hy
  const halfSegment = Math.abs(hx - hy)
  const sx =
    node.cx + (horizontal ? Math.max(-halfSegment, Math.min(halfSegment, point.x - node.cx)) : 0)
  const sy =
    node.cy + (horizontal ? 0 : Math.max(-halfSegment, Math.min(halfSegment, point.y - node.cy)))
  const dx = point.x - sx
  const dy = point.y - sy
  const length = Math.hypot(dx, dy)
  const radius = Math.min(hx, hy)
  return length === 0
    ? { x: sx, y: sy - radius }
    : { x: sx + (dx / length) * radius, y: sy + (dy / length) * radius }
}

/** Raw point in node-box coordinates: normalization only, no border projection. */
export function pointRelativeToBox(
  node: { cx: number; cy: number; w: number; h: number },
  point: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: (point.x - node.cx) / (node.w / 2 + NODE_PAD),
    y: (point.y - node.cy) / (node.h / 2 + NODE_PAD),
  }
}

/** Inverse of {@link pointRelativeToBox}: flow point for box coordinates. */
export function pointFromBox(
  node: { cx: number; cy: number; w: number; h: number },
  point: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: node.cx + point.x * (node.w / 2 + NODE_PAD),
    y: node.cy + point.y * (node.h / 2 + NODE_PAD),
  }
}

export function attachmentAt(
  node: { cx: number; cy: number; w: number; h: number },
  point: { x: number; y: number },
): EndpointAttachment {
  return pointRelativeToBox(node, closestPillBorder(node, point))
}

export function attachmentPoint(
  node: { cx: number; cy: number; w: number; h: number },
  attachment: EndpointAttachment,
): { x: number; y: number } {
  return closestPillBorder(node, pointFromBox(node, attachment))
}

/**
 * Exit point of an arc end: the saved border attachment, the free-drag
 * center, or the automatic exit towards the curve's control point.
 */
function arcEndPoint(
  box: { cx: number; cy: number; w: number; h: number },
  attachment: EndpointAttachment | undefined,
  freeEnd: boolean,
  toX: number,
  toY: number,
) {
  if (attachment && !freeEnd) return attachmentPoint(box, attachment)
  if (freeEnd) return { x: box.cx, y: box.cy }
  return rectExit(box.cx, box.cy, box.w + NODE_PAD * 2, box.h + NODE_PAD * 2, toX, toY)
}

/**
 * An interactive quadratic through a grabbed point. Its node exits point
 * towards that point, so both ends follow the gesture. Solving the Bézier
 * equation for its control point then places B(t) on the pointer exactly —
 * without iterating or restricting motion to the chord normal.
 */
export function anchoredArc(
  source: { cx: number; cy: number; w: number; h: number },
  target: { cx: number; cy: number; w: number; h: number },
  anchor: { x: number; y: number; t: number },
  freeEnd?: 'source' | 'target',
  attachments: { source?: EndpointAttachment; target?: EndpointAttachment } = {},
) {
  const { x, y, t } = anchor
  const a = arcEndPoint(source, attachments.source, freeEnd === 'source', x, y)
  const b = arcEndPoint(target, attachments.target, freeEnd === 'target', x, y)
  const u = 1 - t
  const weight = 2 * u * t
  const cpx = (x - u * u * a.x - t * t * b.x) / weight
  const cpy = (y - u * u * a.y - t * t * b.y) / weight
  return {
    a,
    b,
    cpx,
    cpy,
    path: `M ${a.x} ${a.y} Q ${cpx} ${cpy} ${b.x} ${b.y}`,
    labelX: (a.x + 2 * cpx + b.x) / 4,
    labelY: (a.y + 2 * cpy + b.y) / 4,
    arrowAngle: Math.atan2(b.y - cpy, b.x - cpx),
  }
}

/** Keep a dragged curve's position relative to the source→target chord. */
export function rebaseArcAnchor(
  anchor: { x: number; y: number; t: number },
  fromSource: { cx: number; cy: number },
  fromTarget: { cx: number; cy: number },
  toSource: { cx: number; cy: number },
  toTarget: { cx: number; cy: number },
) {
  const dx = fromTarget.cx - fromSource.cx
  const dy = fromTarget.cy - fromSource.cy
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) {
    return {
      x: anchor.x + toSource.cx - fromSource.cx,
      y: anchor.y + toSource.cy - fromSource.cy,
      t: anchor.t,
    }
  }
  const px = anchor.x - fromSource.cx
  const py = anchor.y - fromSource.cy
  const along = (px * dx + py * dy) / lengthSquared
  const across = (py * dx - px * dy) / lengthSquared
  const nextDx = toTarget.cx - toSource.cx
  const nextDy = toTarget.cy - toSource.cy
  return {
    x: toSource.cx + along * nextDx - across * nextDy,
    y: toSource.cy + along * nextDy + across * nextDx,
    t: anchor.t,
  }
}

/** Geometry shared by a real edge and its endpoint-reconnect preview. */
export function edgeArcGeometry(
  source: { cx: number; cy: number; w: number; h: number },
  target: { cx: number; cy: number; w: number; h: number },
  options: {
    straight?: boolean
    curveOffset?: number
    siblingIdx?: number
    anchor?: { x: number; y: number; t: number }
    freeEnd?: 'source' | 'target'
    sourceAttachment?: EndpointAttachment
    targetAttachment?: EndpointAttachment
  } = {},
) {
  const {
    straight = false,
    curveOffset = 1,
    siblingIdx = 0,
    anchor,
    freeEnd,
    sourceAttachment,
    targetAttachment,
  } = options
  if (anchor && !straight)
    return anchoredArc(source, target, anchor, freeEnd, {
      source: sourceAttachment,
      target: targetAttachment,
    })

  const { cpx, cpy } = straight
    ? { cpx: target.cx, cpy: target.cy }
    : arcControlPoint(source.cx, source.cy, target.cx, target.cy, siblingIdx, curveOffset)
  const a = arcEndPoint(
    source,
    sourceAttachment,
    freeEnd === 'source',
    straight ? target.cx : cpx,
    straight ? target.cy : cpy,
  )
  const b = arcEndPoint(
    target,
    targetAttachment,
    freeEnd === 'target',
    straight ? source.cx : cpx,
    straight ? source.cy : cpy,
  )
  return { a, b, ...nessoArcPath(a.x, a.y, b.x, b.y, siblingIdx, straight, curveOffset) }
}

export interface ConnectionPreview {
  path: string
  /** True when the cursor is over a concept (creation shows a stronger line). */
  snapped: boolean
}

/**
 * Connection-creation preview from a fixed node center to the cursor,
 * optionally snapped onto a concept's border. Both creation and reconnect
 * use edgeArcGeometry, the same path as the committed edge.
 */
export function connectionPreview(
  fromCx: number,
  fromCy: number,
  fromW: number,
  fromH: number,
  toX: number,
  toY: number,
  toNode: { cx: number; cy: number; w: number; h: number } | null,
  straight = false,
  curveOffset = 1,
  siblingIdx = 0,
  targetAttachment?: EndpointAttachment,
): ConnectionPreview {
  return {
    path: edgeArcGeometry(
      { cx: fromCx, cy: fromCy, w: fromW, h: fromH },
      toNode ?? { cx: toX, cy: toY, w: 0, h: 0 },
      {
        straight,
        curveOffset,
        siblingIdx,
        freeEnd: toNode ? undefined : 'target',
        targetAttachment,
      },
    ).path,
    snapped: toNode !== null,
  }
}

export function nessoArcPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  siblingIdx = 0,
  straight = false,
  curveOffset = 1,
): { path: string; labelX: number; labelY: number; arrowAngle: number; cpx: number; cpy: number } {
  if (straight) {
    const lx = (sx + tx) / 2
    const ly = (sy + ty) / 2
    return {
      path: `M ${sx} ${sy} L ${tx} ${ty}`,
      labelX: lx,
      labelY: ly,
      arrowAngle: Math.atan2(ty - sy, tx - sx),
      cpx: tx,
      cpy: ty,
    }
  }

  const { cpx, cpy } = arcControlPoint(sx, sy, tx, ty, siblingIdx, curveOffset)

  const path = `M ${sx} ${sy} Q ${cpx} ${cpy} ${tx} ${ty}`
  const labelX = cpx * 0.5 + (sx + tx) * 0.25
  const labelY = cpy * 0.5 + (sy + ty) * 0.25
  const arrowAngle = Math.atan2(ty - cpy, tx - cpx)

  return { path, labelX, labelY, arrowAngle, cpx, cpy }
}
