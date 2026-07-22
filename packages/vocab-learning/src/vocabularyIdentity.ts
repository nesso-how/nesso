// SPDX-License-Identifier: MIT
//
// Vocabulary identity constant shared between document validation and the public API.
// Extracted to avoid a circular dependency: both index.ts and document.ts import it.

/** OKG vocabulary identity — version bumps only on normative vocabulary changes, not npm releases. */
export const VOCABULARY = {
  id: '@nesso-how/vocab-learning',
  name: 'Nesso Learning Vocabulary',
  domain: 'learning',
  version: '0.1.0',
} as const
