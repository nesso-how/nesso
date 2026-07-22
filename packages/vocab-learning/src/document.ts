// SPDX-License-Identifier: MIT
//
// Learning-vocabulary graph file I/O: wraps `@nesso-how/schema` serialize/deserialize
// and adds validation (elaboration shape, known `relation.type` ids).
import { deserialize as deserializeSchema, serialize as serializeSchema } from '@nesso-how/schema'
import type {
  NessoConceptData,
  NessoGraphDocument,
  NessoGraphDocumentInput,
  NessoRelationData,
} from './graphDocument.js'
import { RELATION_TYPES } from './relationTypes.js'
import { VOCABULARY } from './vocabularyIdentity.js'

const VALID_RELATION_TYPES = new Set<string>(Object.keys(RELATION_TYPES))

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

/** Compare two semver strings. Returns positive if a > b, negative if a < b, 0 if equal. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (Number.isNaN(na) || Number.isNaN(nb)) return 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

/**
 * Validate vocabulary identity: ensures a vocabulary is declared, its id matches
 * the learning vocabulary, and its version is not newer than current (forward guard).
 * Older versions pass through so the normalizer can migrate them.
 */
function validateVocabularyIdentity(
  vocabulary: NessoGraphDocument['vocabulary'],
): asserts vocabulary is NonNullable<NessoGraphDocument['vocabulary']> {
  if (vocabulary === undefined) {
    throw new Error('Graph document must declare a vocabulary')
  }

  if (vocabulary.id !== VOCABULARY.id) {
    throw new Error(`Unsupported graph vocabulary: ${vocabulary.id}`)
  }

  // Forward guard: reject documents from a newer vocabulary version.
  if (compareVersions(vocabulary.version, VOCABULARY.version) > 0) {
    throw new Error(`Unsupported learning vocabulary version: ${vocabulary.version}`)
  }
}

function validateElaboration(value: unknown): void {
  const elab = asRecord(value)
  if (
    !elab ||
    typeof elab.definition !== 'string' ||
    Object.keys(elab).length !== 1 ||
    !Object.hasOwn(elab, 'definition')
  ) {
    throw new Error('Concept elaboration must contain only definition')
  }
}

function validateRelations<M extends Record<string, unknown>>(doc: NessoGraphDocument<M>): void {
  for (let i = 0; i < doc.relations.length; i++) {
    const rel = doc.relations[i]
    if (rel.type !== undefined && !VALID_RELATION_TYPES.has(rel.type)) {
      throw new Error(
        `Invalid Nesso graph document: unknown relation type "${rel.type}" at relations[${i}]`,
      )
    }
  }
}

/**
 * Strict post-migration document shape validation.
 * Rejects: missing/foreign vocabulary, newer vocabulary versions, non-current
 * vocabulary versions (older versions should be migrated before calling this),
 * extra elaboration keys, and unknown relation types.
 */
export function validateNessoDocument<M extends Record<string, unknown>>(
  doc: NessoGraphDocument<M>,
): NessoGraphDocument<M> {
  validateVocabularyIdentity(doc.vocabulary)

  // After migration the version must match exactly.
  if (doc.vocabulary!.version !== VOCABULARY.version) {
    throw new Error(`Unsupported learning vocabulary version: ${doc.vocabulary!.version}`)
  }

  for (let i = 0; i < doc.concepts.length; i++) {
    const data = doc.concepts[i].data
    if (data?.elaboration !== undefined) {
      validateElaboration(data.elaboration)
    }
  }
  validateRelations(doc)
  return doc
}

/**
 * Parse a Nesso graph document envelope without vocabulary-level validation.
 * Validates JSON structure and schema format only; vocabulary identity, version,
 * elaboration shape, and relation types are NOT checked. Callers must run
 * {@link validateNessoDocument} (or equivalent checks) before the document
 * reaches the store.
 */
export function deserializeEnvelope<M extends Record<string, unknown> = Record<string, unknown>>(
  json: string,
): NessoGraphDocument<M> {
  return deserializeSchema<NessoConceptData, NessoRelationData, M>(json)
}

/** Serialize a Nesso Learning Vocabulary graph document to JSON. Always injects the current vocabulary metadata. */
export function serialize<M extends Record<string, unknown>>(
  doc: NessoGraphDocumentInput<M>,
): string {
  return serializeSchema({
    ...doc,
    vocabulary: VOCABULARY,
  })
}

/**
 * Parse and strictly validate a Nesso Learning Vocabulary graph document.
 * This is the convenience entry point that does envelope parsing + full
 * validation. Use {@link deserializeEnvelope} + manual checks when vocabulary
 * migration must run between parsing and validation.
 */
export function deserialize<M extends Record<string, unknown> = Record<string, unknown>>(
  json: string,
): NessoGraphDocument<M> {
  return validateNessoDocument(deserializeEnvelope<M>(json))
}
