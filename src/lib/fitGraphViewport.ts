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

export function computeFitViewport(
  nodes: FitNode[],
  insets: CanvasInsets,
): Viewport {
  const canvasW = window.innerWidth - insets.left - insets.right
  const canvasH = window.innerHeight - insets.top - insets.bottom

  if (nodes.length === 0) {
    return {
      x: insets.left + canvasW / 2,
      y: insets.top + canvasH / 2,
      zoom: 0.75,
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
    Math.min(
      canvasW / (nodeW * (1 + 2 * PADDING)),
      canvasH / (nodeH * (1 + 2 * PADDING)),
      2.5,
    ),
  )

  return {
    x: insets.left + canvasW / 2 - ((minX + maxX) / 2) * zoom,
    y: insets.top + canvasH / 2 - ((minY + maxY) / 2) * zoom,
    zoom,
  }
}
