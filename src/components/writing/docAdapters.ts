// SPDX-License-Identifier: MIT
import type { JSONContent } from '@tiptap/core'
import { isEmptyNotesDocument } from '@nesso-how/vocab-learning'
import type { NotesDocument } from '@/types/graph'

// App-side document adapters: unknown-block degradation for editing, and
// canonicalization on commit. The vocabulary guard passes unknown blocks;
// TipTap cannot parse them, so the editor view degrades them to paragraphs.
// Degradation is lossless: text and marks pass through verbatim (direct
// `text` on unknown leaves included), inline content is never re-joined or
// trimmed, and only block boundaries split into separate paragraphs. Every
// marks-bearing node is deep-copied, so the degraded output never aliases the
// source document. Content is never silently destroyed.

const KNOWN_BLOCK_TYPES = new Set([
  'doc',
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'horizontalRule',
  'hardBreak',
  'text',
  'callout',
  'example',
])

function withContent(node: JSONContent, content: JSONContent[] | undefined): JSONContent {
  return content === undefined ? node : { ...node, content }
}

/** Deep-copy a plain JSON-ish value (own enumerable properties, recursively). */
function deepCopy<T>(value: T): T {
  if (Array.isArray(value)) return value.map(deepCopy) as T
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        deepCopy(child),
      ]),
    ) as T
  }
  return value
}

/**
 * Replacement text node for an unknown leaf's direct `text`, marks carried.
 * Marks are deep-copied (array + each mark object) so the degraded output never
 * aliases the source document — later editor mutation cannot corrupt the input
 * or leak across copies.
 */
function replacementTextNode(node: JSONContent): JSONContent {
  return {
    type: 'text',
    text: node.text as string,
    ...(Array.isArray(node.marks) ? { marks: deepCopy(node.marks) } : {}),
  }
}

/**
 * Inline context: known inline nodes (text with marks, hardBreak) pass through
 * as fresh nodes with their marks deep-copied; anything else unwraps to its
 * direct text or its degraded children. No inline path aliases the source.
 */
function degradeInline(node: JSONContent): JSONContent[] {
  if (node.type === 'text' || node.type === 'hardBreak') {
    return [
      {
        ...node,
        ...(Array.isArray(node.marks) ? { marks: deepCopy(node.marks) } : {}),
      },
    ]
  }
  if (typeof node.text === 'string') return [replacementTextNode(node)]
  return (node.content ?? []).flatMap(degradeInline)
}

/** A block child is a known block (inline nodes aside) or any content array. */
function isBlockChild(node: JSONContent): boolean {
  if (node.type === 'text' || node.type === 'hardBreak') return false
  return (
    Array.isArray(node.content) || (node.type !== undefined && KNOWN_BLOCK_TYPES.has(node.type))
  )
}

/**
 * Degrade one block-level node; may split into several known blocks.
 * `paragraph`/`heading` carry inline content; other known blocks carry blocks.
 */
function degradeBlock(node: JSONContent): JSONContent[] {
  const type = node.type
  if (type === 'paragraph' || type === 'heading') {
    return [withContent(node, node.content?.flatMap(degradeInline))]
  }
  if (type === undefined || KNOWN_BLOCK_TYPES.has(type)) {
    return [withContent(node, node.content?.flatMap(degradeBlock))]
  }
  return unknownToParagraphs(node)
}

/**
 * Unknown block → its paragraphs. Consecutive inline children form one
 * paragraph's content verbatim; each block-ish child degrades separately, so
 * separation happens only at block boundaries. A text-only unknown leaf keeps
 * its direct `text` untrimmed; a truly empty unknown block degrades away.
 */
function unknownToParagraphs(node: JSONContent): JSONContent[] {
  if (!Array.isArray(node.content)) {
    if (typeof node.text !== 'string' || node.text === '') return []
    return [{ type: 'paragraph', content: [replacementTextNode(node)] }]
  }
  const paragraphs: JSONContent[] = []
  let inline: JSONContent[] = []
  const flush = () => {
    if (inline.length > 0) {
      paragraphs.push({ type: 'paragraph', content: inline })
      inline = []
    }
  }
  for (const child of node.content) {
    if (isBlockChild(child)) {
      flush()
      paragraphs.push(...degradeBlock(child))
    } else {
      inline.push(...degradeInline(child))
    }
  }
  flush()
  return paragraphs
}

/** Prepare persisted notes for the editor: unknown blocks become paragraphs. */
export function toEditableDoc(notes: NotesDocument | undefined): JSONContent {
  if (notes === undefined) return { type: 'doc', content: [] }
  const [doc] = degradeBlock(notes as unknown as JSONContent)
  return doc ?? { type: 'doc', content: [] }
}

/** Canonical commit: no flattenable text → `notes: undefined`. */
export function commitDoc(doc: JSONContent | undefined): NotesDocument | undefined {
  if (doc === undefined) return undefined
  const notes = asNotesDocument(doc)
  return isEmptyNotesDocument(notes) ? undefined : notes
}

/** Structural cast from TipTap's JSONContent to the vocabulary shape. */
export function asNotesDocument(doc: JSONContent): NotesDocument {
  return doc as unknown as NotesDocument
}
