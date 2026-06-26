// SPDX-License-Identifier: MIT
import type { Node } from '@xyflow/react'
import type { ConceptNodeData } from '@/types/graph'

export interface CanvasInsets {
  top: number
  bottom: number
  left: number
  right: number
}

const PADDING = 0.06
const DEFAULT_NODE_W = 80
const DEFAULT_NODE_H = 32

type Viewport = { x: number; y: number; zoom: number }

type FitNode = Pick<Node<ConceptNodeData>, 'position' | 'measured'>

// Embedded/headless WebViews can report a 0×0 window before first layout;
// callers must skip fitting (and retry on resize) while this is unusable.
export function fitCanvasSize(insets: CanvasInsets): { width: number; height: number } {
  return {
    width: window.innerWidth - insets.left - insets.right,
    height: window.innerHeight - insets.top - insets.bottom,
  }
}

export function computeFitViewport(
  nodes: FitNode[],
  insets: CanvasInsets,
  zoomScale = 1,
): Viewport {
  const { width: canvasW, height: canvasH } = fitCanvasSize(insets)

  if (nodes.length === 0) {
    // 1:1 so the first concept dropped on a new graph matches the empty-canvas
    // ghost preview (both rendered at the same scale).
    return {
      x: insets.left + canvasW / 2,
      y: insets.top + canvasH / 2,
      zoom: 1,
    }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const n of nodes) {
    const w = n.measured?.width ?? DEFAULT_NODE_W
    const h = n.measured?.height ?? DEFAULT_NODE_H
    minX = Math.min(minX, n.position.x)
    maxX = Math.max(maxX, n.position.x + w)
    minY = Math.min(minY, n.position.y)
    maxY = Math.max(maxY, n.position.y + h)
  }

  const nodeW = maxX - minX
  const nodeH = maxY - minY

  const zoom = Math.max(
    0.15,
    Math.min(canvasW / (nodeW * (1 + 2 * PADDING)), canvasH / (nodeH * (1 + 2 * PADDING)), 2.5) *
      zoomScale,
  )

  return {
    x: insets.left + canvasW / 2 - ((minX + maxX) / 2) * zoom,
    y: insets.top + canvasH / 2 - ((minY + maxY) / 2) * zoom,
    zoom,
  }
}
