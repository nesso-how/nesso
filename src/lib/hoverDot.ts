// SPDX-License-Identifier: MIT
import { closestPillBorder } from '@nesso-how/graph'

/** Minimal flow-node snapshot the hover dot needs. */
export interface HoverDotSnapshot {
  position: { x: number; y: number }
  measured?: { width?: number; height?: number }
}

/** Node box in flow units, with fallbacks for pre-measure mounts. */
export function hoverDotBox(
  node: HoverDotSnapshot | undefined,
  fallback: { w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  return {
    x: node?.position.x ?? 0,
    y: node?.position.y ?? 0,
    w: node?.measured?.width ?? fallback.w,
    h: node?.measured?.height ?? fallback.h,
  }
}

/** Offset of the hover dot from the node origin: the padded pill-border
 * point nearest the cursor. */
export function hoverDotOffset(
  box: { x: number; y: number; w: number; h: number },
  cursor: { x: number; y: number },
): { left: number; top: number } {
  const border = closestPillBorder(
    { cx: box.x + box.w / 2, cy: box.y + box.h / 2, w: box.w, h: box.h },
    cursor,
  )
  return { left: border.x - box.x, top: border.y - box.y }
}
