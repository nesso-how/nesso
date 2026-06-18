// SPDX-License-Identifier: MIT

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface ViewportXYZoom {
  x: number
  y: number
  zoom: number
}

/**
 * Pan delta (screen px) that tucks `worldBox` back inside the `visible` rect, or
 * null when it already fits (sub-0.5px on both axes). `worldBox` is in flow
 * world space; it is projected to screen space via the viewport. The inspector
 * (right) edge wins ties so the selection clears the docked panel, not just the
 * viewport centre.
 */
export function computeSelectionPan(
  worldBox: Rect,
  viewport: ViewportXYZoom,
  visible: Rect,
): { dx: number; dy: number } | null {
  const elLeft = worldBox.left * viewport.zoom + viewport.x
  const elRight = worldBox.right * viewport.zoom + viewport.x
  const elTop = worldBox.top * viewport.zoom + viewport.y
  const elBottom = worldBox.bottom * viewport.zoom + viewport.y
  let dx = 0
  let dy = 0
  if (visible.right > visible.left) {
    if (elRight > visible.right) dx = visible.right - elRight
    else if (elLeft < visible.left) dx = visible.left - elLeft
  }
  if (visible.bottom > visible.top) {
    if (elBottom > visible.bottom) dy = visible.bottom - elBottom
    else if (elTop < visible.top) dy = visible.top - elTop
  }
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return null
  return { dx, dy }
}
