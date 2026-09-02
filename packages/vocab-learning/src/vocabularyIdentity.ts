// SPDX-License-Identifier: MIT
//
// Vocabulary identity constant shared between document validation and the public API.
// Extracted to avoid a circular dependency: both index.ts and document.ts import it.

/** OKG vocabulary identity — version bumps only on normative vocabulary changes, not npm releases. */
type SupportedVocabularyVersion = '0.1.0' | '0.2.0'

export const VOCABULARY = {
  id: '@nesso-how/vocab-learning',
  name: 'Nesso Learning Vocabulary',
  domain: 'learning',
  // Keep known versions literal so version-aligned types and guards remain
  // type-checkable while the runtime identity stays at the current version.
  version: '0.2.0' as SupportedVocabularyVersion,
} as const
