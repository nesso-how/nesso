// SPDX-License-Identifier: MIT
import type { NotesDocument } from './graphDocument.js'

export const NOTES_MAX_DEPTH = 8
export const NOTES_MAX_SERIALIZED_CHARS = 100_000
const EMPTY_CONTENT_NODE_TYPES = new Set(['paragraph', 'heading', 'codeBlock'])
const SUPPORTED_MARK_TYPES = new Set(['bold', 'italic', 'strike', 'code', 'underline', 'link'])
const LINK_MARK_ATTRS = new Set(['href', 'target', 'rel', 'class', 'title'])

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

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

/** JSON object values accepted for document and content nodes. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || isUnknownArray(value)) return false
  const prototype: object | null = Object.getPrototypeOf(value)
  const objectPrototype: object = Object.prototype
  return prototype === objectPrototype || prototype === null
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(value, key)
}

function isValidMark(value: unknown): value is Record<string, unknown> {
  if (!isPlainObject(value) || typeof value.type !== 'string') return false
  if (!SUPPORTED_MARK_TYPES.has(value.type)) return false
  const keys = Object.keys(value)
  if (keys.some((key) => key !== 'type' && key !== 'attrs')) return false
  if (!hasOwn(value, 'attrs')) return true
  if (!isPlainObject(value.attrs)) return false
  if (value.type !== 'link' && Object.keys(value.attrs).length > 0) return false
  return Object.entries(value.attrs).every(
    ([key, attr]) => LINK_MARK_ATTRS.has(key) && (typeof attr === 'string' || attr === null),
  )
}

function isValidMarks(value: unknown): boolean {
  return isUnknownArray(value) && value.every(isValidMark)
}

function isValidEmptyContentNode(type: string): boolean {
  return EMPTY_CONTENT_NODE_TYPES.has(type) || type === 'hardBreak' || type === 'horizontalRule'
}

function isValidTextNode(value: Record<string, unknown>): boolean {
  return typeof value.text === 'string' && value.text.length > 0 && !hasOwn(value, 'content')
}

function isValidNestedContent(value: Record<string, unknown>): boolean {
  return (
    isUnknownArray(value.content) &&
    value.content.every((child: unknown) => isValidContentNode(child))
  )
}

function isValidNodeMarks(value: Record<string, unknown>, type: string): boolean {
  if (hasOwn(value, 'marks')) {
    if (type !== 'text' && type !== 'hardBreak') return false
    return isValidMarks(value.marks)
  }
  return true
}

function isValidNodeShape(value: Record<string, unknown>, type: string): boolean {
  if (type === 'text') return isValidTextNode(value)
  if (hasOwn(value, 'text')) return false
  if (!hasOwn(value, 'content')) return isValidEmptyContentNode(type)
  return isValidNestedContent(value)
}

/** Validate every node field that the editor may dereference. */
function isValidContentNode(value: unknown): value is Record<string, unknown> {
  if (!isPlainObject(value)) return false
  const type = value.type
  if (typeof type !== 'string' || type.length === 0) return false
  if (type === 'doc') return false
  if (!isValidNodeMarks(value, type)) return false
  return isValidNodeShape(value, type)
}

/** Structural content elements must be non-null plain objects (a text node is
 *  one); null, arrays, or primitives would crash the editor's dereferences. */
function isContentElement(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value)
}

/** Recurse into array/object children at `depth` with cycle tracking. */
function childrenAtMost(value: object, depth: number, ancestors: Set<object>): boolean {
  if (isUnknownArray(value)) {
    const items: unknown[] = value
    return items.every((item) => depthAtMost(item, depth, ancestors))
  }
  const entries: [string, unknown][] = Object.entries(value)
  return entries.every(([key, child]) => {
    // Any `content` array is structural: every element must be a non-null
    // plain object, regardless of the block type carrying it.
    if (key === 'content' && isUnknownArray(child)) {
      const elements: unknown[] = child
      return elements.every((el) => isContentElement(el) && depthAtMost(el, depth, ancestors))
    }
    return depthAtMost(child, depth, ancestors)
  })
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
    if (
      !isPlainObject(value) ||
      value.type !== 'doc' ||
      hasOwn(value, 'text') ||
      !hasOwn(value, 'content') ||
      !isUnknownArray(value.content)
    )
      return false
    if (!value.content.every((child: unknown) => isValidContentNode(child))) return false
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
  if (!isUnknownArray(children)) return typeof text === 'string' ? text : ''
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
