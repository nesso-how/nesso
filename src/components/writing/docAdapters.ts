// SPDX-License-Identifier: MIT
import type { JSONContent } from '@tiptap/core'
import { isEmptyNotesDocument, isValidNotesDocument } from '@nesso-how/vocab-learning'
import type { NotesDocument } from '@/types/graph'

// App-side document adapters: unknown-block degradation for editing, and
// canonicalization on commit. Persisted notes are structurally block-agnostic,
// while TipTap requires a small set of specific parent/child relationships.
// Normalize to that supported content model before the editor sees a document.

type JSONMark = NonNullable<JSONContent['marks']>[number]
const SUPPORTED_MARK_TYPES = new Set(['bold', 'italic', 'strike', 'code', 'underline', 'link'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNode(value: unknown): value is JSONContent {
  return isRecord(value)
}

function childrenOf(node: JSONContent): JSONContent[] {
  return Array.isArray(node.content) ? node.content.filter(isNode) : []
}

function attrsOf(node: JSONContent): Record<string, unknown> | undefined {
  return isRecord(node.attrs) ? node.attrs : undefined
}

function cloneMark(mark: JSONMark): JSONMark {
  return {
    ...mark,
    ...(isRecord(mark.attrs) ? { attrs: { ...mark.attrs } } : {}),
  }
}

function copyMarks(node: JSONContent): JSONMark[] {
  if (!Array.isArray(node.marks)) return []
  const supported = node.marks.filter((mark) => SUPPORTED_MARK_TYPES.has(mark.type))
  const code = supported.find((mark) => mark.type === 'code')
  if (code) return [cloneMark(code)]

  const seen = new Set<string>()
  return supported
    .filter((mark) => {
      if (seen.has(mark.type)) return false
      seen.add(mark.type)
      return true
    })
    .map(cloneMark)
}

function textNode(node: JSONContent): JSONContent | undefined {
  if (typeof node.text !== 'string' || node.text.length === 0) return undefined
  const marks = copyMarks(node)
  return { type: 'text', text: node.text, ...(marks.length > 0 ? { marks } : {}) }
}

function isInlineNode(node: JSONContent): boolean {
  return node.type === 'text' || node.type === 'hardBreak'
}

function isBlockLike(node: JSONContent): boolean {
  return !isInlineNode(node)
}

function joinInlinePieces(pieces: Array<{ nodes: JSONContent[]; block: boolean }>): JSONContent[] {
  const output: JSONContent[] = []
  let previousWasBlock = false
  for (const piece of pieces) {
    if (piece.nodes.length === 0) continue
    if ((previousWasBlock || piece.block) && output.at(-1)?.type !== 'hardBreak') {
      if (output.length > 0) output.push({ type: 'hardBreak' })
    }
    output.push(...piece.nodes)
    previousWasBlock = piece.block
  }
  return output
}

function normalizeInlineNode(node: JSONContent): JSONContent[] {
  if (node.type === 'text') {
    const text = textNode(node)
    return text === undefined ? [] : [text]
  }
  const content = normalizeInlineChildren(node)
  return node.type === 'hardBreak' ? [{ type: 'hardBreak' }, ...content] : content
}

function plainTextOf(node: JSONContent): string {
  return normalizeInlineNode(node)
    .map((child) =>
      child.type === 'hardBreak' ? '\n' : child.type === 'text' ? (child.text ?? '') : '',
    )
    .join('')
}

function emptyParagraph(): JSONContent {
  return { type: 'paragraph' }
}

function normalizeInlineChildren(node: JSONContent): JSONContent[] {
  return joinInlinePieces(
    childrenOf(node).map((child) => ({
      nodes: normalizeInlineNode(child),
      block: isBlockLike(child),
    })),
  )
}

function normalizeBlockChildren(children: JSONContent[]): JSONContent[] {
  const blocks: JSONContent[] = []
  let inline: JSONContent[] = []
  const flushInline = () => {
    if (inline.length > 0) blocks.push({ type: 'paragraph', content: inline })
    inline = []
  }

  for (const child of children) {
    if (isBlockLike(child)) {
      flushInline()
      blocks.push(...normalizeBlock(child))
    } else {
      inline.push(...normalizeInlineNode(child))
    }
  }
  flushInline()
  return blocks
}

function normalizeListItem(node: JSONContent): JSONContent {
  const blocks = normalizeBlockChildren(childrenOf(node))
  const content = blocks.length > 0 ? blocks : [emptyParagraph()]
  if (content[0]?.type === 'paragraph') return { type: 'listItem', content }
  return { type: 'listItem', content: [emptyParagraph(), ...content] }
}

function normalizeListItems(node: JSONContent): JSONContent[] {
  const children = childrenOf(node)
  return children.map((child) => {
    if (child.type === 'listItem') return normalizeListItem(child)

    const blocks = isBlockLike(child)
      ? normalizeBlock(child)
      : [{ type: 'paragraph', content: normalizeInlineNode(child) }]
    const content = blocks.length > 0 ? blocks : [emptyParagraph()]
    return content[0]?.type === 'paragraph'
      ? { type: 'listItem', content }
      : { type: 'listItem', content: [emptyParagraph(), ...content] }
  })
}

function normalizeDocumentBlock(node: JSONContent): JSONContent[] {
  return [
    {
      type: 'doc',
      content: normalizeBlockChildren(childrenOf(node)),
    },
  ]
}

function normalizeParagraphBlock(node: JSONContent): JSONContent[] {
  return [
    {
      type: 'paragraph',
      content: normalizeInlineChildren(node),
    },
  ]
}

function normalizeHeadingBlock(node: JSONContent): JSONContent[] {
  return [
    {
      type: 'heading',
      attrs: { level: attrsOf(node)?.level === 3 ? 3 : 2 },
      content: normalizeInlineChildren(node),
    },
  ]
}

function normalizeContainerBlock(node: JSONContent): JSONContent[] {
  const content = normalizeBlockChildren(childrenOf(node))
  return [{ type: node.type, content: content.length > 0 ? content : [emptyParagraph()] }]
}

function orderedListAttrs(node: JSONContent): { order: number } {
  const order = attrsOf(node)?.order
  return {
    order: typeof order === 'number' && Number.isInteger(order) && order > 0 ? order : 1,
  }
}

function normalizeListBlock(node: JSONContent): JSONContent[] {
  const content = normalizeListItems(node)
  if (content.length === 0) return []
  const attrs = node.type === 'orderedList' ? { attrs: orderedListAttrs(node) } : {}
  return [{ type: node.type, ...attrs, content }]
}

function normalizeLooseListItemBlock(node: JSONContent): JSONContent[] {
  return normalizeBlockChildren(childrenOf(node))
}

function normalizeCodeBlock(node: JSONContent): JSONContent[] {
  const language = attrsOf(node)?.language
  const text = plainTextOf(node)
  return [
    {
      type: 'codeBlock',
      attrs: { language: typeof language === 'string' ? language : null },
      ...(text.length > 0 ? { content: [{ type: 'text', text }] } : {}),
    },
  ]
}

function normalizeHorizontalRule(node: JSONContent): JSONContent[] {
  return [{ type: 'horizontalRule' }, ...normalizeBlockChildren(childrenOf(node))]
}

function normalizeInlineBlock(node: JSONContent): JSONContent[] {
  const content = normalizeInlineNode(node)
  return content.length > 0 ? [{ type: 'paragraph', content }] : []
}

function normalizeUnknownBlock(node: JSONContent): JSONContent[] {
  return normalizeBlockChildren(childrenOf(node))
}

type BlockNormalizer = (node: JSONContent) => JSONContent[]

const BLOCK_NORMALIZERS = Object.assign(Object.create(null) as Record<string, BlockNormalizer>, {
  doc: normalizeDocumentBlock,
  paragraph: normalizeParagraphBlock,
  heading: normalizeHeadingBlock,
  blockquote: normalizeContainerBlock,
  callout: normalizeContainerBlock,
  example: normalizeContainerBlock,
  bulletList: normalizeListBlock,
  orderedList: normalizeListBlock,
  listItem: normalizeLooseListItemBlock,
  codeBlock: normalizeCodeBlock,
  horizontalRule: normalizeHorizontalRule,
  text: normalizeInlineBlock,
  hardBreak: normalizeInlineBlock,
})

function normalizeBlock(node: JSONContent): JSONContent[] {
  const normalize = BLOCK_NORMALIZERS[node.type ?? '']
  return normalize === undefined ? normalizeUnknownBlock(node) : normalize(node)
}

/** Prepare persisted notes for the editor: unknown blocks become paragraphs. */
export function toEditableDoc(notes: NotesDocument | undefined): JSONContent {
  if (notes === undefined || !isValidNotesDocument(notes)) return { type: 'doc', content: [] }
  const source = notes as unknown as JSONContent
  const [doc] = normalizeBlock(source)
  if (doc === undefined || doc.type !== 'doc') return { type: 'doc', content: [] }
  return { ...doc, content: Array.isArray(doc.content) ? doc.content : [] }
}

/**
 * Canonical commit: no flattenable text → `undefined`. The outgoing document is
 * validated against the vocabulary caps (`NOTES_MAX_DEPTH`,
 * `NOTES_MAX_SERIALIZED_CHARS`): an unloadable document (oversize paste,
 * pathological nesting) is NEVER persisted — the caller's last valid committed
 * document is returned instead, so the store keeps a reloadable value.
 */
export function commitDoc(
  doc: JSONContent | undefined,
  fallback?: NotesDocument,
): NotesDocument | undefined {
  if (doc === undefined) return undefined
  if (!isValidNotesDocument(doc)) return fallback
  const notes = asNotesDocument(doc)
  if (isEmptyNotesDocument(notes)) return undefined
  return notes
}

/** Structural cast from TipTap's JSONContent to the vocabulary shape. */
export function asNotesDocument(doc: JSONContent): NotesDocument {
  return doc as unknown as NotesDocument
}
