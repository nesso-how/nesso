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
  isConnected: boolean
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
const DIMMED_OPACITY = 0.28

export function resolveEdgeVisual({
  isSelected,
  hovered,
  isConnected,
  hasSelection,
}: EdgeVisualInput): EdgeVisual {
  if (isSelected) return { width: SELECTED_WIDTH, opacity: FULL_OPACITY, dimmed: false }
  if (hovered) return { width: DEFAULT_WIDTH, opacity: FULL_OPACITY, dimmed: false }
  // Connected edges intentionally keep their default look: selecting a concept
  // only dims the rest of the map, it never restyles the selection itself.
  if (hasSelection && !isConnected)
    return { width: DEFAULT_WIDTH, opacity: DIMMED_OPACITY, dimmed: true }
  return { width: DEFAULT_WIDTH, opacity: DEFAULT_OPACITY, dimmed: false }
}
