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

const VALID_RELATION_TYPES = new Set<string>(Object.keys(RELATION_TYPES))

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function validateElaboration(value: unknown, path: string): void {
  const elab = asRecord(value)
  if (!elab) {
    throw new Error(`Invalid Nesso graph document: ${path}.elaboration must be an object`)
  }
  if (typeof elab.definition !== 'string') {
    throw new Error(`Invalid Nesso graph document: ${path}.elaboration.definition must be a string`)
  }
  if (typeof elab.examples !== 'string') {
    throw new Error(`Invalid Nesso graph document: ${path}.elaboration.examples must be a string`)
  }
  if (typeof elab.notes !== 'string') {
    throw new Error(`Invalid Nesso graph document: ${path}.elaboration.notes must be a string`)
  }
}

function validateNessoDocument<M extends Record<string, unknown>>(
  doc: NessoGraphDocument<M>,
): NessoGraphDocument<M> {
  for (let i = 0; i < doc.concepts.length; i++) {
    const data = doc.concepts[i].data
    if (data?.elaboration !== undefined) {
      validateElaboration(data.elaboration, `concepts[${i}].data`)
    }
  }
  for (let i = 0; i < doc.relations.length; i++) {
    const rel = doc.relations[i]
    if (rel.type !== undefined && !VALID_RELATION_TYPES.has(rel.type)) {
      throw new Error(
        `Invalid Nesso graph document: unknown relation type "${rel.type}" at relations[${i}]`,
      )
    }
  }
  return doc
}

/** Serialize a Nesso Learning Vocabulary graph document to JSON. */
export function serialize<M extends Record<string, unknown>>(
  doc: NessoGraphDocumentInput<M>,
): string {
  return serializeSchema(doc)
}

/** Parse and validate a Nesso Learning Vocabulary graph document. */
export function deserialize<M extends Record<string, unknown> = Record<string, unknown>>(
  json: string,
): NessoGraphDocument<M> {
  const doc = deserializeSchema<NessoConceptData, NessoRelationData, M>(json)
  return validateNessoDocument(doc)
}
