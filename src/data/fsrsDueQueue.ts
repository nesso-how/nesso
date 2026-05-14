// SPDX-License-Identifier: MIT
import { fsrs } from 'ts-fsrs'
import type { Node } from '@xyflow/react'
import type { ConceptNodeData } from '@/types/graph'
import { nodeToCard } from '@/types/graph'

/** Concepts with due ≤ now, sorted earliest-due first. */
export function sortedDueConceptNodes(nodes: Node<ConceptNodeData>[]): Node<ConceptNodeData>[] {
  const t = Date.now()
  return [...nodes]
    .filter(n => n.data.due <= t)
    .sort((a, b) => a.data.due - b.data.due)
}

/** Average retrievability (0–1) across all reviewed concepts, or null if none reviewed.
 *  Evaluated at max(due, now): not-yet-due cards show expected R at their due date
 *  (~target retention), overdue cards show current (degraded) R. */
export function avgRetention(nodes: Node<ConceptNodeData>[]): number | null {
  const reviewed = nodes.filter(n => n.data.fsrsState !== 0)
  if (reviewed.length === 0) return null
  const f = fsrs()
  const now = Date.now()
  const total = reviewed.reduce((sum, n) => {
    const card = nodeToCard(n.data)
    const evalAt = new Date(Math.max(n.data.due, now))
    return sum + (f.get_retrievability(card, evalAt, false) as number)
  }, 0)
  return total / reviewed.length
}
