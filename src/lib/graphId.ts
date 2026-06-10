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

/**
 * Short canvas element id (`n`/`e` + 5 base36 chars), retried until it does not
 * collide with `used`. 36^5 ≈ 60M keeps ids short, but pasting/importing into
 * large graphs makes a collision check necessary — a duplicate id corrupts
 * selection and edge remapping.
 */
export function newElementId(prefix: 'n' | 'e', used: ReadonlySet<string>): string {
  for (;;) {
    const id = prefix + Math.random().toString(36).slice(2, 7)
    if (!used.has(id)) return id
  }
}
