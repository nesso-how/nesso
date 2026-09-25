// SPDX-License-Identifier: MIT

export function isEdgeConnectedToNode(
  source: string,
  target: string,
  selectedNodeId: string | null | undefined,
): boolean {
  if (!selectedNodeId) return false
  return source === selectedNodeId || target === selectedNodeId
}

export interface EdgeVisualInput {
  isSelected: boolean
  hovered: boolean
  /** Keeps its default look during a focus: connected to the selected concept,
   * or being the selected relation itself (its endpoints stay highlighted). */
  inFocus: boolean
  hasSelection: boolean
}

export interface EdgeVisual {
  width: number
  opacity: number
  dimmed: boolean
}

const SELECTED_WIDTH = 2
const DEFAULT_WIDTH = 1.4
const FULL_OPACITY = 1
const DEFAULT_OPACITY = 0.78
export const DIMMED_OPACITY = 0.28
/** Dimmed concepts stay slightly more visible than dimmed relations. */
export const NODE_DIMMED_OPACITY = 0.4

export function resolveEdgeVisual({
  isSelected,
  hovered,
  inFocus,
  hasSelection,
}: EdgeVisualInput): EdgeVisual {
  if (isSelected) return { width: SELECTED_WIDTH, opacity: FULL_OPACITY, dimmed: false }
  // Hover enlarges the stroke exactly like selection: it signals that the
  // arc itself is draggable from any middle point.
  if (hovered) return { width: SELECTED_WIDTH, opacity: FULL_OPACITY, dimmed: false }
  // In-focus edges intentionally keep their default look: focusing a concept
  // or a relation only dims the rest of the map, it never restyles the
  // focus itself.
  if (hasSelection && !inFocus)
    return { width: DEFAULT_WIDTH, opacity: DIMMED_OPACITY, dimmed: true }
  return { width: DEFAULT_WIDTH, opacity: DEFAULT_OPACITY, dimmed: false }
}
