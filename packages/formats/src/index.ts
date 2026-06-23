// SPDX-License-Identifier: MIT
import type { Node, Edge } from '@xyflow/react'
import type { GraphDisplaySettings } from '@nesso-how/types'

/** Current on-disk graph file schema version. Bump only when the envelope shape changes. */
export const GRAPH_FORMAT_VERSION = 1 as const

export interface NessoGraphFile<D extends Record<string, unknown> = Record<string, unknown>> {
  /** File format version — always {@link GRAPH_FORMAT_VERSION} for the current schema. */
  version: typeof GRAPH_FORMAT_VERSION
  /**
   * Vocabulary this graph was built with: its id (e.g. `@nesso-how/vocab-learning`)
   * and normative version. Opaque to formats, which only round-trips the reference.
   */
  vocabulary?: { id: string; version: string }
  /** Internal graph id (desktop sync); omitted in manual exports. */
  id?: string
  /** Last save time (Unix ms); desktop sync metadata. */
  updatedAt?: number
  name: string
  nodes: Node<D>[]
  edges: Edge[]
  display?: Partial<GraphDisplaySettings>
}

/** Graph payload for {@link serializeGraph} — format version is injected by the serializer. */
export type NessoGraphFileInput<D extends Record<string, unknown> = Record<string, unknown>> = Omit<
  NessoGraphFile<D>,
  'version'
>

/** Serialize a graph to JSON with keys in a stable, human-readable order. */
export function serializeGraph<D extends Record<string, unknown>>(
  file: NessoGraphFileInput<D>,
): string {
  const { vocabulary, id, updatedAt, name, nodes, edges, display } = file
  return JSON.stringify(
    {
      version: GRAPH_FORMAT_VERSION,
      ...(vocabulary !== undefined && { vocabulary }),
      ...(id !== undefined && { id }),
      ...(updatedAt !== undefined && { updatedAt }),
      name,
      nodes,
      edges,
      ...(display !== undefined && { display }),
    },
    null,
    2,
  )
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

/**
 * Parse and structurally validate a graph file. Files are user-editable (and
 * importable from anywhere), so each element is checked before it can reach
 * the store: a node without a valid id/position crashes the canvas and would
 * then be re-persisted. Vocabulary-specific normalization (e.g. private params)
 * is the caller's responsibility.
 */
export function deserializeGraph<D extends Record<string, unknown> = Record<string, unknown>>(
  json: string,
): NessoGraphFile<D> {
  const data: unknown = JSON.parse(json)
  const root = asRecord(data)
  if (!root || !Array.isArray(root.nodes) || !Array.isArray(root.edges)) {
    throw new Error('Invalid Nesso graph file: missing nodes or edges array')
  }
  if (typeof root.version === 'number' && root.version !== GRAPH_FORMAT_VERSION) {
    throw new Error(`Unsupported Nesso graph file version: ${root.version}`)
  }
  const nodes = root.nodes.map((value, i) => {
    const node = asRecord(value)
    const pos = node ? asRecord(node.position) : null
    if (
      !node ||
      typeof node.id !== 'string' ||
      node.id === '' ||
      !pos ||
      typeof pos.x !== 'number' ||
      !Number.isFinite(pos.x) ||
      typeof pos.y !== 'number' ||
      !Number.isFinite(pos.y)
    ) {
      throw new Error(`Invalid Nesso graph file: node ${i} is missing a valid id or position`)
    }
    return node
  })
  const edges = root.edges.map((value, i) => {
    const edge = asRecord(value)
    if (
      !edge ||
      typeof edge.id !== 'string' ||
      typeof edge.source !== 'string' ||
      typeof edge.target !== 'string'
    ) {
      throw new Error(`Invalid Nesso graph file: edge ${i} is missing id, source or target`)
    }
    return edge
  })
  return {
    ...root,
    version: GRAPH_FORMAT_VERSION,
    nodes,
    edges,
  } as unknown as NessoGraphFile<D>
}

/** Overwrite private node params with vocabulary defaults (e.g. for share export/import). */
export function stripPrivateNodeParams<D extends Record<string, unknown>>(
  nodes: Node<D>[],
  privateDefaults: Partial<D>,
): Node<D>[] {
  return nodes.map((node) => ({
    ...node,
    data: { ...node.data, ...privateDefaults },
  }))
}
