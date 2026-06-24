// SPDX-License-Identifier: MIT
//
// Typed shape of a shared graph JSON file for this vocabulary: concept/relation
// `data` payloads and `NessoGraphDocument` aliases over `@nesso-how/schema`.
// FSRS and other private node params are not part of the on-disk document.
import type { GraphDocument, GraphDocumentInput } from '@nesso-how/schema'

export interface ConceptElaboration {
  definition: string
  examples: string
  notes: string
  imageUrl?: string
  imageTitle?: string
  imageDescriptionUrl?: string
}

/** Shared concept content in a Nesso graph document (no label, no FSRS). */
export interface NessoConceptData extends Record<string, unknown> {
  elaboration?: ConceptElaboration
}

/** Shared relation content in a Nesso graph document. */
export interface NessoRelationData extends Record<string, unknown> {
  curveFlip?: boolean
  curveFlipPinned?: boolean
}

export type NessoGraphDocument<M extends Record<string, unknown> = Record<string, unknown>> =
  GraphDocument<NessoConceptData, NessoRelationData, M>

export type NessoGraphDocumentInput<M extends Record<string, unknown> = Record<string, unknown>> =
  GraphDocumentInput<NessoConceptData, NessoRelationData, M>
