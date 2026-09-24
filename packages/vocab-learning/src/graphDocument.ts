// SPDX-License-Identifier: MIT
//
// Typed shape of a shared graph JSON file for this vocabulary: concept/relation
// `data` payloads and `NessoGraphDocument` aliases over `@nesso-how/schema`.
// FSRS and other private node params are not part of the on-disk document.
import type { GraphDocument, GraphDocumentInput } from '@nesso-how/schema'
import type { VOCABULARY } from './vocabularyIdentity.js'

export interface NotesNode {
  type?: string
  text?: string
  content?: NotesNode[]
  [key: string]: unknown
}

export interface NotesDocument {
  type: 'doc'
  content: NotesNode[]
}

interface DefinitionOnlyConceptElaboration {
  definition: string
}

interface NotesConceptElaboration extends DefinitionOnlyConceptElaboration {
  notes?: NotesDocument
}

// Keep the public elaboration shape aligned with the normative vocabulary version:
// the 0.2.0 bump automatically enables notes without labeling 0.1.0 documents as such.
export type ConceptElaboration = typeof VOCABULARY.version extends '0.1.0'
  ? DefinitionOnlyConceptElaboration
  : NotesConceptElaboration

/** Shared concept content in a Nesso graph document (no label, no FSRS). */
export interface NessoConceptData extends Record<string, unknown> {
  elaboration?: ConceptElaboration
}

/** Shared relation content in a Nesso graph document. */
export interface NessoRelationData extends Record<string, unknown> {
  /**
   * Signed multiplier of the default arc bow: 1 = default side, -1 = mirrored,
   * 0 = straight, |offset| > 1 exaggerates the bow. Legacy `curveFlip: true`
   * documents are read as -1 on load.
   */
  curveOffset?: number
}

export type NessoGraphDocument<M extends Record<string, unknown> = Record<string, unknown>> =
  GraphDocument<NessoConceptData, NessoRelationData, M>

export type NessoGraphDocumentInput<M extends Record<string, unknown> = Record<string, unknown>> =
  GraphDocumentInput<NessoConceptData, NessoRelationData, M>

/**
 * Short document element id (`n`/`e` + 5 base36 chars), retried until it does
 * not collide with `used`. 36^5 ≈ 60M keeps ids short, but pasting/importing
 * into large graphs makes a collision check necessary — a duplicate id corrupts
 * selection and edge remapping.
 */
export function newElementId(prefix: 'n' | 'e', used: ReadonlySet<string>): string {
  for (;;) {
    const id = prefix + Math.random().toString(36).slice(2, 7)
    if (!used.has(id)) return id
  }
}
