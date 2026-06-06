// SPDX-License-Identifier: MIT
import type { Node, Edge } from '@xyflow/react'
import type { ConceptNodeData } from '@/types/graph'
import { CONCEPT_HANDLE_IN, CONCEPT_HANDLE_OUT } from '@/data/conceptHandles'
import { stripEdgeSelection, stripNodeSelection } from '@/lib/graphPersist'

export type GraphClipboard = {
  nodes: Node<ConceptNodeData>[]
  edges: Edge[]
}

const PASTE_OFFSET = { x: 48, y: 48 }

let clipboard: GraphClipboard | null = null

export function setGraphClipboard(payload: GraphClipboard | null): void {
  clipboard = payload
}

export function getGraphClipboard(): GraphClipboard | null {
  return clipboard
}

type SelectionInput = {
  nodes: Node<ConceptNodeData>[]
  edges: Edge[]
  selected: { kind: 'node' | 'edge'; id: string } | null
  selectedIds: string[]
}

/** Build a copy payload from the current canvas selection. */
export function snapshotSelection(s: SelectionInput): GraphClipboard | null {
  const explicitNodeIds = new Set<string>()
  if (s.selected?.kind === 'node') explicitNodeIds.add(s.selected.id)
  for (const id of s.selectedIds) explicitNodeIds.add(id)

  const explicitEdgeIds = new Set<string>()
  if (s.selected?.kind === 'edge') explicitEdgeIds.add(s.selected.id)
  for (const e of s.edges) {
    if (e.selected) explicitEdgeIds.add(e.id)
  }

  const edgeOnly = explicitEdgeIds.size > 0 && explicitNodeIds.size === 0
  const nodeIds = new Set(explicitNodeIds)

  if (edgeOnly) {
    for (const eid of explicitEdgeIds) {
      const e = s.edges.find((x) => x.id === eid)
      if (e) {
        nodeIds.add(e.source)
        nodeIds.add(e.target)
      }
    }
  }

  const edgeIds = new Set<string>()
  if (edgeOnly) {
    for (const eid of explicitEdgeIds) edgeIds.add(eid)
  } else {
    for (const e of s.edges) {
      if (nodeIds.has(e.source) && nodeIds.has(e.target)) edgeIds.add(e.id)
    }
    for (const eid of explicitEdgeIds) edgeIds.add(eid)
  }

  if (nodeIds.size === 0 && edgeIds.size === 0) return null

  return {
    nodes: s.nodes.filter((n) => nodeIds.has(n.id)).map(stripNodeSelection),
    edges: s.edges.filter((e) => edgeIds.has(e.id)).map(stripEdgeSelection),
  }
}

export function instantiateClipboard(clip: GraphClipboard): {
  nodes: Node<ConceptNodeData>[]
  edges: Edge[]
} {
  const idMap = new Map<string, string>()
  for (const n of clip.nodes) {
    idMap.set(n.id, 'n' + Math.random().toString(36).slice(2, 7))
  }

  const nodes = clip.nodes.map((n) => ({
    ...n,
    id: idMap.get(n.id)!,
    position: {
      x: n.position.x + PASTE_OFFSET.x,
      y: n.position.y + PASTE_OFFSET.y,
    },
    selected: true,
  }))

  const edges = clip.edges.map((e) => ({
    ...e,
    id: 'e' + Math.random().toString(36).slice(2, 8),
    source: idMap.get(e.source) ?? e.source,
    target: idMap.get(e.target) ?? e.target,
    sourceHandle: e.sourceHandle ?? CONCEPT_HANDLE_OUT,
    targetHandle: e.targetHandle ?? CONCEPT_HANDLE_IN,
    type: 'nesso' as const,
    selected: false,
  }))

  return { nodes, edges }
}

/** Shift clipboard positions so repeated paste cascades instead of stacking. */
export function advanceClipboardAfterPaste(): void {
  if (!clipboard) return
  setGraphClipboard({
    nodes: clipboard.nodes.map((n) => ({
      ...n,
      position: {
        x: n.position.x + PASTE_OFFSET.x,
        y: n.position.y + PASTE_OFFSET.y,
      },
    })),
    edges: clipboard.edges,
  })
}
