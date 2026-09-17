// SPDX-License-Identifier: MIT
import { fsrs } from 'ts-fsrs'
import type { Node } from '@xyflow/react'
import type { ConceptNodeData } from '@/types/graph'
import { nodeToCard } from '@/types/graph'

/** Concepts with due ≤ now, sorted earliest-due first. */
export function sortedDueConceptNodes(nodes: Node<ConceptNodeData>[]): Node<ConceptNodeData>[] {
  const t = Date.now()
  return [...nodes].filter((n) => n.data.due <= t).sort((a, b) => a.data.due - b.data.due)
}

/** Studied concepts with due ≤ now; never-studied cards (reps = 0) are excluded. */
export function studiedDueCount(nodes: Node<ConceptNodeData>[], nowMs: number): number {
  return nodes.filter((node) => node.data.reps > 0 && node.data.due <= nowMs).length
}
