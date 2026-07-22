// SPDX-License-Identifier: AGPL-3.0-only

import { documentToRenderGraph } from '@nesso-how/graph'
import {
  VOCABULARY,
  deserializeEnvelope,
  validateNessoDocument,
  type NessoGraphDocument,
} from '@nesso-how/vocab-learning'
import { defaultGraphDisplay } from '@/types/graph'
import { graphToDocument } from '@/lib/graphDocumentMapping'
import { GRAPH_RECORD_VERSION, type GraphRecord } from '@/store/db'

export { GRAPH_RECORD_VERSION }

type VocabularyMigration = (document: NessoGraphDocument) => NessoGraphDocument

const VOCABULARY_MIGRATIONS: Partial<Record<string, VocabularyMigration>> = {}

type GraphRecordMigration = (record: Record<string, unknown>) => unknown

const GRAPH_RECORD_MIGRATIONS: Partial<Record<number, GraphRecordMigration>> = {}

interface RecordIdentity {
  id: string
  createdAt: number
  updatedAt: number
  name?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Returns true when `a` is a newer semver than `b`. */
function isNewerVersion(a: string, b: string): boolean {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (Number.isNaN(na) || Number.isNaN(nb)) return false
    if (na > nb) return true
    if (na < nb) return false
  }
  return false
}

function migrateVocabulary(document: NessoGraphDocument): NessoGraphDocument {
  let current = document

  if (current.vocabulary === undefined) {
    throw new Error('Graph document must declare a vocabulary')
  }

  let vocab = current.vocabulary

  while (true) {
    if (vocab.version === VOCABULARY.version) break

    const migrate = VOCABULARY_MIGRATIONS[vocab.version]

    if (migrate === undefined) {
      throw new Error(`Unsupported learning vocabulary version: ${vocab.version}`)
    }

    const migrated = migrate(current)

    if (migrated.vocabulary?.version === vocab.version) {
      throw new Error(`Vocabulary migration ${vocab.version} did not advance the version`)
    }

    current = migrated
    vocab = migrated.vocabulary!
  }

  return current
}

export function normalizeParsedGraphDocument(
  document: NessoGraphDocument,
  identity: RecordIdentity,
): GraphRecord {
  // 1. Validate vocabulary identity and forward guard.
  //    Foreign ids and newer versions are rejected immediately.
  //    Older versions pass through so migration can run.
  if (document.vocabulary === undefined) {
    throw new Error('Graph document must declare a vocabulary')
  }
  if (document.vocabulary.id !== VOCABULARY.id) {
    throw new Error(`Unsupported graph vocabulary: ${document.vocabulary.id}`)
  }
  if (isNewerVersion(document.vocabulary.version, VOCABULARY.version)) {
    throw new Error(
      `Graph document is from a newer vocabulary version: ${document.vocabulary.version}`,
    )
  }

  // 2. Sequential vocabulary migration (rejects older versions with no migration step).
  const migrated = migrateVocabulary(document)

  // 3. Strict current-shape validation (version match, elaboration, relation types).
  validateNessoDocument(migrated)

  const { nodes, edges, display } = documentToRenderGraph(migrated)
  const resolvedDisplay =
    display === undefined ? undefined : { ...defaultGraphDisplay(), ...display }

  return {
    recordVersion: GRAPH_RECORD_VERSION,
    vocabulary: {
      id: VOCABULARY.id,
      version: VOCABULARY.version,
    },
    id: identity.id,
    name: identity.name ?? migrated.name,
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
    nodes,
    edges,
    ...(resolvedDisplay === undefined ? {} : { display: resolvedDisplay }),
  }
}

export function normalizeGraphDocument(
  input: string | unknown,
  identity: RecordIdentity,
): GraphRecord {
  const serialized = typeof input === 'string' ? input : JSON.stringify(input)

  // Parse the envelope (schema-level structural validation only).
  const document = deserializeEnvelope(serialized)

  return normalizeParsedGraphDocument(document, identity)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function hasValidRecordFields(record: Record<string, unknown>): boolean {
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.createdAt === 'number' &&
    Number.isFinite(record.createdAt) &&
    typeof record.updatedAt === 'number' &&
    Number.isFinite(record.updatedAt) &&
    Array.isArray(record.nodes) &&
    Array.isArray(record.edges)
  )
}

function isValidGraphRecordShape(record: Record<string, unknown>): boolean {
  const vocab = asRecord(record.vocabulary)

  return (
    record.recordVersion === GRAPH_RECORD_VERSION &&
    vocab !== null &&
    vocab.id === VOCABULARY.id &&
    vocab.version === VOCABULARY.version &&
    hasValidRecordFields(record)
  )
}

function migrateRecordToVersion(
  input: Record<string, unknown>,
  startVersion: number,
): Record<string, unknown> {
  let current: unknown = input
  let version = startVersion

  while (version < GRAPH_RECORD_VERSION) {
    const migrate = GRAPH_RECORD_MIGRATIONS[version]

    if (migrate === undefined) {
      throw new Error(`Unsupported graph-record version: ${version}`)
    }

    current = migrate(current as Record<string, unknown>)

    if (!isRecord(current) || current.recordVersion !== version + 1) {
      throw new Error(`Graph-record migration ${version} must produce version ${version + 1}`)
    }

    version += 1
  }

  if (!isRecord(current)) throw new Error('Invalid graph record')

  return current
}

function validateRecordVocabulary(record: Record<string, unknown>): void {
  const vocab = asRecord(record.vocabulary)

  if (!vocab) throw new Error('Graph record has an unsupported vocabulary')
  if (vocab.id !== VOCABULARY.id) throw new Error('Graph record has an unsupported vocabulary')

  if (isNewerVersion(vocab.version as string, VOCABULARY.version)) {
    throw new Error('Graph record has an unsupported vocabulary')
  }

  if (vocab.version !== VOCABULARY.version) {
    throw new Error(`Unsupported graph-record vocabulary version: ${vocab.version}`)
  }
}

type GraphRecordNode = GraphRecord['nodes'][number]
type GraphRecordEdge = GraphRecord['edges'][number]

function isFiniteNumericPosition(pos: unknown): pos is { x: number; y: number } {
  const p = pos as Record<string, unknown> | undefined
  return (
    !!p &&
    typeof p.x === 'number' &&
    Number.isFinite(p.x) &&
    typeof p.y === 'number' &&
    Number.isFinite(p.y)
  )
}

/** Validate a single React Flow node and return its id for the node-id set. */
function validateSingleGraphRecordNode(n: GraphRecordNode): string {
  if (typeof n.id !== 'string' || !n.id) {
    throw new Error('Invalid graph record: node missing id')
  }
  if (typeof n.data?.text !== 'string') {
    throw new Error('Invalid graph record: node missing text')
  }
  if (!isFiniteNumericPosition(n.position)) {
    throw new Error('Invalid graph record: node has invalid position')
  }
  return n.id
}

/** Validate React Flow node/edge format invariants that the document
 *  round-trip does not enforce. Returns the set of valid node ids for use
 *  by {@link validateGraphRecordEdges}. */
function validateGraphRecordNodes(nodes: GraphRecord['nodes']): Set<string> {
  const nodeIds = new Set<string>()
  for (const n of nodes) {
    nodeIds.add(validateSingleGraphRecordNode(n))
  }
  return nodeIds
}

/** Validate a single React Flow edge: id, nesso type, and source/target
 *  references must point into the known node-id set. */
function validateSingleGraphRecordEdge(e: GraphRecordEdge, nodeIds: ReadonlySet<string>): void {
  if (typeof e.id !== 'string' || !e.id) {
    throw new Error('Invalid graph record: edge missing id')
  }
  if (e.type !== 'nesso') {
    throw new Error('Invalid graph record: edge missing nesso type')
  }
  if (typeof e.source !== 'string' || !nodeIds.has(e.source)) {
    throw new Error('Invalid graph record: edge has missing or unknown source')
  }
  if (typeof e.target !== 'string' || !nodeIds.has(e.target)) {
    throw new Error('Invalid graph record: edge has missing or unknown target')
  }
}

/** Validate React Flow edge format invariants: id, nesso type, and
 *  source/target references must point into the known node-id set. */
function validateGraphRecordEdges(edges: GraphRecord['edges'], nodeIds: ReadonlySet<string>): void {
  for (const e of edges) {
    validateSingleGraphRecordEdge(e, nodeIds)
  }
}

/** Round-trip the record through the document format so the existing
 *  package/schema validators (elaboration shape, relation types, etc.)
 *  check the actual content without duplicating the graph model.
 *  Also verifies the round-trip preserves node count and id ordering. */
function validateGraphRecordRoundTrip(record: GraphRecord): void {
  const doc = graphToDocument({
    id: record.id,
    name: record.name,
    nodes: record.nodes,
    edges: record.edges,
    display: record.display ?? defaultGraphDisplay(),
    updatedAt: record.updatedAt,
  })

  // Cast: graphToDocument returns NessoGraphDocumentInput (omits `version`),
  // but validateNessoDocument requires NessoGraphDocument (includes `version`).
  // The `version` field is schema-level metadata; the validator only inspects
  // concepts, relations, and vocabulary — all of which are present.
  validateNessoDocument(doc as NessoGraphDocument)

  const { nodes, edges } = documentToRenderGraph(doc)

  if (nodes.length !== record.nodes.length) {
    throw new Error('Deep validation of graph record failed: node count mismatch')
  }
  if (edges.length !== record.edges.length) {
    throw new Error('Deep validation of graph record failed: edge count mismatch')
  }

  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id !== record.nodes[i].id) {
      throw new Error('Deep validation of graph record failed: node id mismatch')
    }
  }
}

function deepValidateGraphRecordContent(record: GraphRecord): void {
  const nodeIds = validateGraphRecordNodes(record.nodes)
  validateGraphRecordEdges(record.edges, nodeIds)
  validateGraphRecordRoundTrip(record)
}

/**
 * Resolves the identity (id and name) of a graph document from its serialized
 * envelope *without* full normalization. Only the vocabulary compatibility
 * boundary is enforced so callers can distinguish supported files from
 * unsupported ones without paying the cost of a full render transform.
 *
 * Returns `null` when the envelope is unparseable or the document uses an
 * unsupported vocabulary (foreign id, newer version, missing version, no
 * migration path). Returns the identity when the document passes the boundary
 * check.
 */
export function tryResolveGraphIdentityFromEnvelope(
  serialized: string,
): { id: string; name: string } | null {
  let file: NessoGraphDocument
  try {
    file = deserializeEnvelope(serialized)
  } catch {
    return null
  }

  if (file.vocabulary === undefined) return null
  if (file.vocabulary.id !== VOCABULARY.id) return null
  if (isNewerVersion(file.vocabulary.version, VOCABULARY.version)) return null

  // Must have a known migration path or be at the current version.
  if (file.vocabulary.version !== VOCABULARY.version) {
    const migrate = VOCABULARY_MIGRATIONS[file.vocabulary.version]
    if (migrate === undefined) return null
  }

  return { id: file.id ?? '', name: file.name ?? '' }
}

export function normalizeGraphRecord(input: unknown): GraphRecord {
  if (!isRecord(input)) throw new Error('Invalid graph record')

  const version: unknown = input.recordVersion

  if (typeof version !== 'number') throw new Error('Unsupported graph-record version: missing')
  if (version > GRAPH_RECORD_VERSION) throw new Error('Graph record is from a newer app version')

  const current = migrateRecordToVersion(input, version)

  validateRecordVocabulary(current)

  if (!isValidGraphRecordShape(current)) throw new Error('Invalid graph record shape')

  const record = current as unknown as GraphRecord

  deepValidateGraphRecordContent(record)

  return record
}
