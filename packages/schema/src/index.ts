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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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
  if (!isRecord(data) || !Array.isArray(data.concepts) || !Array.isArray(data.relations)) {
    throw new Error('Invalid Nesso graph document: missing concepts or relations array')
  }
  if (typeof data.version === 'number' && data.version !== GRAPH_FORMAT_VERSION) {
    throw new Error(`Unsupported Nesso graph document version: ${data.version}`)
  }
  const rawConcepts: unknown[] = data.concepts
  const concepts: GraphConcept<NC>[] = rawConcepts.map((value: unknown, i: number) => {
    if (
      !isRecord(value) ||
      typeof value.id !== 'string' ||
      value.id === '' ||
      typeof value.label !== 'string' ||
      typeof value.x !== 'number' ||
      !Number.isFinite(value.x) ||
      typeof value.y !== 'number' ||
      !Number.isFinite(value.y)
    ) {
      throw new Error(
        `Invalid Nesso graph document: concept ${i} is missing a valid id, label, or position`,
      )
    }
    const conceptData: NC | undefined = value.data as NC | undefined
    return {
      id: value.id,
      label: value.label,
      x: value.x,
      y: value.y,
      ...(conceptData !== undefined && { data: conceptData }),
    } as GraphConcept<NC>
  })
  const rawRelations: unknown[] = data.relations
  const relations: GraphRelation<RE>[] = rawRelations.map((value: unknown, i: number) => {
    if (
      !isRecord(value) ||
      typeof value.id !== 'string' ||
      typeof value.source !== 'string' ||
      typeof value.target !== 'string'
    ) {
      throw new Error(`Invalid Nesso graph document: relation ${i} is missing id, source or target`)
    }
    const relationType: string | undefined =
      typeof value.type === 'string' ? value.type : undefined
    const relationData: RE | undefined = value.data as RE | undefined
    return {
      id: value.id,
      source: value.source,
      target: value.target,
      ...(relationType !== undefined && { type: relationType }),
      ...(relationData !== undefined && { data: relationData }),
    } as GraphRelation<RE>
  })
  const name: string = typeof data.name === 'string' ? data.name : ''
  const docId: string | undefined = typeof data.id === 'string' ? data.id : undefined
  const updatedAt: number | undefined =
    typeof data.updatedAt === 'number' ? data.updatedAt : undefined
  let vocabulary: { id: string; version: string } | undefined
  const vocabValue: unknown = data.vocabulary
  if (
    isRecord(vocabValue) &&
    typeof vocabValue.id === 'string' &&
    typeof vocabValue.version === 'string'
  ) {
    vocabulary = { id: vocabValue.id, version: vocabValue.version }
  }
  let meta: M | undefined
  const metaValue: unknown = data.meta
  if (metaValue !== undefined) {
    meta = metaValue as M
  }
  return {
    version: GRAPH_FORMAT_VERSION,
    ...(vocabulary !== undefined && { vocabulary }),
    ...(docId !== undefined && { id: docId }),
    ...(updatedAt !== undefined && { updatedAt }),
    name,
    concepts,
    relations,
    ...(meta !== undefined && { meta }),
  }
}
