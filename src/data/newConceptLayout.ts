// SPDX-License-Identifier: MIT
import type { Node } from '@xyflow/react'
import type { ConceptNodeData } from '@/types/graph'

/** Default footprint for a new "New concept" label (flow px). */
export const NEW_CONCEPT_SIZE = { width: 112, height: 34 } as const

const PLACEMENT_MARGIN = 12
const PLACEMENT_STEP = 32
const MAX_PLACEMENT_ATTEMPTS = 24

function nodeRect(n: Node<ConceptNodeData>) {
  return {
    x: n.position.x,
    y: n.position.y,
    w: n.measured?.width ?? NEW_CONCEPT_SIZE.width,
    h: n.measured?.height ?? NEW_CONCEPT_SIZE.height,
  }
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  margin: number,
): boolean {
  return !(
    ax + aw + margin <= bx ||
    bx + bw + margin <= ax ||
    ay + ah + margin <= by ||
    by + bh + margin <= ay
  )
}

/** Top-left flow position so the node footprint is centered on (flowX, flowY). */
export function newConceptTopLeftAtFlowCenter(flowX: number, flowY: number) {
  return {
    x: flowX - NEW_CONCEPT_SIZE.width / 2,
    y: flowY - NEW_CONCEPT_SIZE.height / 2,
  }
}

/** Top-left near flow center; nudges diagonally when another node occupies the spot. */
export function findNewConceptPosition(
  nodes: Node<ConceptNodeData>[],
  flowCenterX: number,
  flowCenterY: number,
) {
  const { width: w, height: h } = NEW_CONCEPT_SIZE
  const { x: baseX, y: baseY } = newConceptTopLeftAtFlowCenter(flowCenterX, flowCenterY)

  const occupied = (x: number, y: number) =>
    nodes.some((n) => {
      const r = nodeRect(n)
      return rectsOverlap(x, y, w, h, r.x, r.y, r.w, r.h, PLACEMENT_MARGIN)
    })

  for (let i = 0; i < MAX_PLACEMENT_ATTEMPTS; i++) {
    const x = baseX + i * PLACEMENT_STEP
    const y = baseY + i * PLACEMENT_STEP
    if (!occupied(x, y)) return { x, y }
  }

  return { x: baseX, y: baseY }
}
