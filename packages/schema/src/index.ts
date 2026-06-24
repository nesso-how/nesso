// SPDX-License-Identifier: MIT

/** Current on-disk graph document schema version. Bump only when the envelope shape changes. */
export const GRAPH_FORMAT_VERSION = 1 as const

export interface GraphConcept<D extends Record<string, unknown> = Record<string, unknown>> {
  id: string
  label: string
  x: number
  y: number
  data?: D
}

export interface GraphRelation<D extends Record<string, unknown> = Record<string, unknown>> {
  id: string
  source: string
  target: string
  type?: string
  data?: D
}

export interface GraphDocument<
  NC extends Record<string, unknown> = Record<string, unknown>,
  RE extends Record<string, unknown> = Record<string, unknown>,
  M extends Record<string, unknown> = Record<string, unknown>,
> {
  /** File format version — always {@link GRAPH_FORMAT_VERSION} for the current schema. */
  version: typeof GRAPH_FORMAT_VERSION
  /**
   * Vocabulary this graph was built with: its id (e.g. `@nesso-how/vocab-learning`)
   * and normative version. Opaque to schema, which only round-trips the reference.
   */
  vocabulary?: { id: string; version: string }
  /** Internal graph id (desktop sync); omitted in manual exports. */
  id?: string
  /** Last save time (Unix ms); desktop sync metadata. */
  updatedAt?: number
  name: string
  concepts: GraphConcept<NC>[]
  relations: GraphRelation<RE>[]
  meta?: M
}

/** Graph payload for {@link serialize} — format version is injected by the serializer. */
export type GraphDocumentInput<
  NC extends Record<string, unknown> = Record<string, unknown>,
  RE extends Record<string, unknown> = Record<string, unknown>,
  M extends Record<string, unknown> = Record<string, unknown>,
> = Omit<GraphDocument<NC, RE, M>, 'version'>

/** Serialize a graph document to JSON with keys in a stable, human-readable order. */
export function serialize<
  NC extends Record<string, unknown>,
  RE extends Record<string, unknown>,
  M extends Record<string, unknown>,
>(doc: GraphDocumentInput<NC, RE, M>): string {
  const { vocabulary, id, updatedAt, name, concepts, relations, meta } = doc
  return JSON.stringify(
    {
      version: GRAPH_FORMAT_VERSION,
      ...(vocabulary !== undefined && { vocabulary }),
      ...(id !== undefined && { id }),
      ...(updatedAt !== undefined && { updatedAt }),
      name,
      concepts,
      relations,
      ...(meta !== undefined && { meta }),
    },
    null,
    2,
  )
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

/**
 * Parse and structurally validate a graph document. Files are user-editable (and
 * importable from anywhere), so each element is checked before it can reach
 * the store: a concept without a valid id/position crashes the canvas and would
 * then be re-persisted. Vocabulary-specific normalization is the caller's responsibility.
 */
export function deserialize<
  NC extends Record<string, unknown> = Record<string, unknown>,
  RE extends Record<string, unknown> = Record<string, unknown>,
  M extends Record<string, unknown> = Record<string, unknown>,
>(json: string): GraphDocument<NC, RE, M> {
  const data: unknown = JSON.parse(json)
  const root = asRecord(data)
  if (!root || !Array.isArray(root.concepts) || !Array.isArray(root.relations)) {
    throw new Error('Invalid Nesso graph document: missing concepts or relations array')
  }
  if (typeof root.version === 'number' && root.version !== GRAPH_FORMAT_VERSION) {
    throw new Error(`Unsupported Nesso graph document version: ${root.version}`)
  }
  const concepts = root.concepts.map((value, i) => {
    const concept = asRecord(value)
    if (
      !concept ||
      typeof concept.id !== 'string' ||
      concept.id === '' ||
      typeof concept.label !== 'string' ||
      typeof concept.x !== 'number' ||
      !Number.isFinite(concept.x) ||
      typeof concept.y !== 'number' ||
      !Number.isFinite(concept.y)
    ) {
      throw new Error(
        `Invalid Nesso graph document: concept ${i} is missing a valid id, label, or position`,
      )
    }
    return concept
  })
  const relations = root.relations.map((value, i) => {
    const relation = asRecord(value)
    if (
      !relation ||
      typeof relation.id !== 'string' ||
      typeof relation.source !== 'string' ||
      typeof relation.target !== 'string'
    ) {
      throw new Error(`Invalid Nesso graph document: relation ${i} is missing id, source or target`)
    }
    return relation
  })
  return {
    ...root,
    version: GRAPH_FORMAT_VERSION,
    concepts,
    relations,
  } as unknown as GraphDocument<NC, RE, M>
}
