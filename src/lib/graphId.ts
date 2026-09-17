// SPDX-License-Identifier: MIT

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'
const ID_SUFFIX_LENGTH = 13

/**
 * Opaque graph id (`g` + 13 lowercase alphanumeric chars).
 * The `g` prefix ensures the id never starts with a digit, making it safe
 * as a CSS selector, URL hash, and HTML id attribute.
 */
export function newGraphId(): string {
  let id = 'g'
  for (let i = 0; i < ID_SUFFIX_LENGTH; i++) {
    id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]
  }
  return id
}

export function isGraphId(value: string): boolean {
  return /^g[a-z0-9]{13}$/.test(value)
}

// Element ids are vocabulary-owned document identity: the generator lives in
// `@nesso-how/vocab-learning` so the app and the MCP package share one
// implementation — import it from there. `newGraphId`/`isGraphId` stay
// app-local: graph ids are an app-level concern, not document element identity.
