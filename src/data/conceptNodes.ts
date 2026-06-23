// SPDX-License-Identifier: MIT
import type { Node } from '@xyflow/react'
import { stripPrivateNodeParams } from '@nesso-how/formats'
import { defaultConceptReviewFields, type ConceptNodeData } from '@/types/graph'

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function coerceText(data: Record<string, unknown>): string {
  return typeof data.text === 'string' ? data.text : ''
}

function withRecordData(node: Node<Record<string, unknown>>): Node<Record<string, unknown>> {
  return { ...node, data: asRecord(node.data) ?? {} }
}

/** Fill missing private params without overwriting persisted review history (disk load). */
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

/** Reset private params and coerce text for share export/import. */
export function resetConceptNodeParamsForShare(
  nodes: Node<Record<string, unknown>>[],
): Node<ConceptNodeData>[] {
  return stripPrivateNodeParams(nodes.map(withRecordData), defaultConceptReviewFields()).map(
    (node) => ({
      ...node,
      data: { ...node.data, text: coerceText(node.data) } as ConceptNodeData,
    }),
  )
}
