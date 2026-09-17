// SPDX-License-Identifier: MIT
//
// Public entry point for `@nesso-how/vocab-learning`. Re-exports the split modules
// below; import from here unless you need a specific submodule in-package.

export type {
  ConceptElaboration,
  NotesDocument,
  NotesNode,
  NessoConceptData,
  NessoRelationData,
  NessoGraphDocument,
  NessoGraphDocumentInput,
} from './graphDocument.js'

export { VOCABULARY } from './vocabularyIdentity.js'

// Re-exported so downstream packages with a layering boundary against
// `@nesso-how/schema` (e.g. `@nesso-how/theme`) can share the canonical guard.
export { isPlainObject } from '@nesso-how/schema'

export {
  defaultConceptReviewFields,
  type ConceptNodeData,
  type LearningNodeParams,
} from './nodeParams.js'

export {
  RELATION_CATEGORIES,
  RELATION_TYPES,
  RELATION_TYPE_VALUES,
  isPrimaryRelationType,
  type Cardinality,
  type GlyphKind,
  type Polarity,
  type RelationCategory,
  type RelationTypeDef,
  type RelationTypeName,
  type Transitivity,
} from './relationTypes.js'

export { CategoryPalette, categoryCssVars, GLYPH_PATHS, PALETTES } from './visual.js'

export {
  checkVocabularyIdentity,
  compareVersions,
  deserialize,
  deserializeEnvelope,
  serialize,
  validateDefinitionOnlyElaboration,
  validateNessoDocument,
} from './document.js'

export {
  NOTES_MAX_DEPTH,
  NOTES_MAX_SERIALIZED_CHARS,
  countNotesWords,
  isEmptyNotesDocument,
  isValidNotesDocument,
  notesToPlainText,
  paragraphNotesFromPlainText,
  validateNotesDocument,
} from './notes.js'
