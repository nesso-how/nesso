// SPDX-License-Identifier: MIT
import type { Node } from '@xyflow/react'
import { defaultConceptReviewFields, type ConceptNodeData } from '@/types/graph'

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function coerceText(data: Record<string, unknown>): string {
  return typeof data.text === 'string' ? data.text : ''
}

/** Fill missing FSRS defaults on runtime nodes (e.g. newly created concepts). */
export function fillConceptNodeParams(
  nodes: Node<Record<string, unknown>>[],
): Node<ConceptNodeData>[] {
  const defaults = defaultConceptReviewFields()
  return nodes.map((node) => {
    const d = asRecord(node.data) ?? {}
    return {
      ...node,
      data: { ...defaults, ...d, text: coerceText(d) } as ConceptNodeData,
    }
  })
}
