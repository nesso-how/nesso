// SPDX-License-Identifier: MIT
import type { NotesDocument } from './graphDocument.js'

export const NOTES_MAX_DEPTH = 8
export const NOTES_MAX_SERIALIZED_CHARS = 100_000

/** Note payloads may never carry these values: undefined, functions, symbols,
 *  bigints (they serialize lossily or not at all). */
function isDisallowedValue(value: unknown): boolean {
  return (
    typeof value === 'undefined' ||
    typeof value === 'function' ||
    typeof value === 'symbol' ||
    typeof value === 'bigint'
  )
}

/** Recurse into array/object children at `depth` with cycle tracking. */
function childrenAtMost(value: object, depth: number, ancestors: Set<object>): boolean {
  if (Array.isArray(value)) {
    return value.every((item) => depthAtMost(item, depth, ancestors))
  }
  return Object.values(value).every((child) => depthAtMost(child, depth, ancestors))
}

function depthAtMost(value: unknown, depth: number, ancestors: Set<object>): boolean {
  if (depth > NOTES_MAX_DEPTH) return false
  if (isDisallowedValue(value)) return false
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object' || value === null) return true
  if (ancestors.has(value)) return false

  ancestors.add(value)
  try {
    return childrenAtMost(value, depth + 1, ancestors)
  } finally {
    ancestors.delete(value)
  }
}

export function isValidNotesDocument(value: unknown): boolean {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    const node = value as { type?: unknown; content?: unknown }
    if (node.type !== 'doc' || !Array.isArray(node.content)) return false
    if (!depthAtMost(value, 1, new Set<object>())) return false
    const serialized = JSON.stringify(value)
    return serialized !== undefined && serialized.length <= NOTES_MAX_SERIALIZED_CHARS
  } catch {
    return false
  }
}

export function validateNotesDocument(value: unknown): void {
  if (!isValidNotesDocument(value)) {
    throw new Error('Concept notes must be a bounded { type: "doc", content: [] } document')
  }
}

function isInlineish(node: unknown): boolean {
  if (typeof node !== 'object' || node === null) return false
  const type = (node as { type?: unknown }).type
  return type === 'text' || type === 'hardBreak'
}

function flattenNode(node: unknown): string {
  if (typeof node !== 'object' || node === null) return ''
  if (isInlineish(node)) {
    const { type, text } = node as { type?: string; text?: unknown }
    if (type === 'hardBreak') return ' '
    return typeof text === 'string' ? text : ''
  }
  const { content: children, text } = node as { content?: unknown; text?: unknown }
  if (!Array.isArray(children)) return typeof text === 'string' ? text : ''
  const parts = children.map(flattenNode)
  return parts.some((_, index) => !isInlineish(children[index])) ? parts.join('\n') : parts.join('')
}

export function notesToPlainText(notes: NotesDocument | undefined): string {
  if (notes === undefined) return ''
  return flattenNode(notes)
    .replace(/\n{2,}/g, '\n')
    .trim()
}

export function countNotesWords(notes: NotesDocument | undefined): number {
  const text = notesToPlainText(notes)
  if (!text) return 0
  return text.split(/\s+/).length
}

export function isEmptyNotesDocument(notes: NotesDocument | undefined): boolean {
  return notesToPlainText(notes).trim() === ''
}

export function paragraphNotesFromPlainText(text: string): NotesDocument | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: trimmed }] }],
  }
}
