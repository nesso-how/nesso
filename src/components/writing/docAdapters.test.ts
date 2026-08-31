// SPDX-License-Identifier: MIT
import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { asNotesDocument, commitDoc, toEditableDoc } from './docAdapters'

describe('toEditableDoc', () => {
  it('degrades unknown block types to paragraphs with their text', () => {
    const doc = toEditableDoc({
      type: 'doc',
      content: [
        {
          type: 'futureBlock',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'keep me' }] }],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'after' }] },
      ],
    } as never)
    expect(doc.content?.[0]?.type).toBe('paragraph')
    expect(JSON.stringify(doc)).toContain('keep me')
    expect(JSON.stringify(doc)).not.toContain('futureBlock')
  })

  it('keeps known block types untouched', () => {
    const doc = toEditableDoc({
      type: 'doc',
      content: [
        {
          type: 'callout',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'c' }] }],
        },
      ],
    } as never)
    expect(doc.content?.[0]?.type).toBe('callout')
  })
})

describe('toEditableDoc — lossless degradation', () => {
  it('preserves adjacent marked text verbatim inside unknown blocks (no join, no trim)', () => {
    const doc = toEditableDoc({
      type: 'doc',
      content: [
        {
          type: 'futureBlock',
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'text', text: 'world', marks: [{ type: 'bold' }] },
            { type: 'text', text: '!' },
          ],
        },
      ],
    } as never)
    expect(doc.content).toEqual([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world', marks: [{ type: 'bold' }] },
          { type: 'text', text: '!' },
        ],
      },
    ])
  })

  it('does not insert spaces between adjacent inline text nodes', () => {
    const doc = toEditableDoc({
      type: 'doc',
      content: [
        {
          type: 'futureBlock',
          content: [
            { type: 'text', text: 'ab' },
            { type: 'text', text: 'cd' },
          ],
        },
      ],
    } as never)
    expect(doc.content?.[0]?.content).toEqual([
      { type: 'text', text: 'ab' },
      { type: 'text', text: 'cd' },
    ])
  })

  it('preserves direct text on unknown leaf nodes without trimming', () => {
    const doc = toEditableDoc({
      type: 'doc',
      content: [{ type: 'futureStamp', text: '  padded  ' }],
    } as never)
    expect(doc.content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: '  padded  ' }] },
    ])
  })

  it('splits unknown block content into separate paragraphs at block boundaries', () => {
    const doc = toEditableDoc({
      type: 'doc',
      content: [
        {
          type: 'futureBlock',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'two' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'three' }] },
          ],
        },
      ],
    } as never)
    expect(doc.content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'two' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'three' }] },
    ])
  })

  it('keeps inline runs and nested blocks as distinct paragraphs inside unknown blocks', () => {
    const doc = toEditableDoc({
      type: 'doc',
      content: [
        {
          type: 'futureBlock',
          content: [
            { type: 'text', text: 'intro' },
            { type: 'paragraph', content: [{ type: 'text', text: 'body' }] },
          ],
        },
      ],
    } as never)
    expect(doc.content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'intro' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'body' }] },
    ])
  })

  it('degrades nested unknown blocks at their boundaries', () => {
    const doc = toEditableDoc({
      type: 'doc',
      content: [
        {
          type: 'futureOuter',
          content: [{ type: 'futureInner', content: [{ type: 'text', text: 'deep' }] }],
        },
      ],
    } as never)
    expect(doc.content).toEqual([{ type: 'paragraph', content: [{ type: 'text', text: 'deep' }] }])
  })

  it('passes known paragraph inline content through verbatim (hardBreak, spacing, marks)', () => {
    const doc = toEditableDoc({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'a' },
            { type: 'hardBreak' },
            { type: 'text', text: 'b  c', marks: [{ type: 'italic' }] },
          ],
        },
      ],
    } as never)
    expect(doc.content?.[0]).toEqual({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'a' },
        { type: 'hardBreak' },
        { type: 'text', text: 'b  c', marks: [{ type: 'italic' }] },
      ],
    })
  })

  it('degrades an empty unknown block to nothing', () => {
    const doc = toEditableDoc({ type: 'doc', content: [{ type: 'futureEmpty' }] } as never)
    expect(doc.content).toEqual([])
  })

  it('carries marks through when degrading unknown leaves with direct text', () => {
    const doc = toEditableDoc({
      type: 'doc',
      content: [
        { type: 'futureStamp', text: 'hi', marks: [{ type: 'bold' }] },
        {
          type: 'futureBlock',
          content: [{ type: 'futureMention', text: ' yo', marks: [{ type: 'italic' }] }],
        },
      ],
    } as never)
    expect(doc.content).toEqual([
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'hi', marks: [{ type: 'bold' }] }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: ' yo', marks: [{ type: 'italic' }] }],
      },
    ])
  })

  it('deep-copies marks so degraded output never aliases the input document', () => {
    const marks: JSONContent[] = [{ type: 'bold', attrs: { level: 1 } }]
    const doc = toEditableDoc({
      type: 'doc',
      content: [
        { type: 'futureStamp', text: 'hi', marks },
        {
          type: 'futureBlock',
          content: [{ type: 'futureMention', text: ' yo', marks }],
        },
      ],
    } as never)

    // Array identity: the degraded copy is a fresh array, not the source's.
    const degraded = doc.content?.[0]?.content?.[0]?.marks
    if (!degraded) throw new Error('expected degraded marks')
    expect(degraded).not.toBe(marks)

    // Per-mark fields and array shape: mutating the copy leaves the input
    // document untouched.
    const mark = degraded[0]
    if (!mark) throw new Error('expected degraded mark')
    mark.type = 'italic'
    const attrs = mark.attrs as { level: number } | undefined
    if (!attrs) throw new Error('expected copied attrs')
    attrs.level = 99
    degraded.push({ type: 'strike' })
    expect(marks[0]?.type).toBe('bold')
    expect((marks[0]?.attrs as { level: number }).level).toBe(1)
    expect(marks).toHaveLength(1)

    // The nested unknown leaf inside the block gets its own copy of the same
    // shared source array, independent of both it and the first leaf.
    const nested = doc.content?.[1]?.content?.[0]?.marks
    if (!nested) throw new Error('expected nested marks')
    expect(nested).not.toBe(marks)
    expect(nested).not.toBe(degraded)
    expect(nested[0]?.type).toBe('bold')
    expect((nested[0]?.attrs as { level: number }).level).toBe(1)
  })

  it('deep-copies marks on pass-through text nodes sharing one source array', () => {
    const marks: JSONContent[] = [{ type: 'bold', attrs: { level: 1 } }]
    const doc = toEditableDoc({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'one ', marks },
            { type: 'text', text: 'two', marks },
          ],
        },
      ],
    } as never)

    const first = doc.content?.[0]?.content?.[0]
    const second = doc.content?.[0]?.content?.[1]
    if (!first?.marks || !second?.marks) throw new Error('expected marks on both nodes')

    // Independent fresh arrays — never the source's, never each other's.
    expect(first.marks).not.toBe(marks)
    expect(second.marks).not.toBe(marks)
    expect(first.marks).not.toBe(second.marks)

    // Mutating the degraded output — array shape, mark fields, nested attrs —
    // never touches the input document.
    first.marks.push({ type: 'strike' })
    first.marks[0].type = 'italic'
    const firstAttrs = first.marks[0].attrs as { level: number }
    firstAttrs.level = 99
    expect(marks).toHaveLength(1)
    expect(marks[0].type).toBe('bold')
    expect((marks[0].attrs as { level: number }).level).toBe(1)

    // The second copy is untouched by mutations to the first.
    expect(second.marks).toHaveLength(1)
    expect(second.marks[0].type).toBe('bold')
    expect((second.marks[0].attrs as { level: number }).level).toBe(1)
  })
})

describe('commitDoc', () => {
  it('canonicalizes empty documents to undefined', () => {
    expect(commitDoc(undefined)).toBeUndefined()
    expect(commitDoc({ type: 'doc', content: [] })).toBeUndefined()
    expect(commitDoc({ type: 'doc', content: [{ type: 'paragraph' }] })).toBeUndefined()
  })

  it('keeps documents with text', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
    }
    expect(commitDoc(doc as never)).toEqual(doc)
  })
})

describe('asNotesDocument', () => {
  it('casts editor JSONContent into the vocabulary NotesDocument shape', () => {
    const json = { type: 'doc', content: [] }
    expect(asNotesDocument(json as never)).toEqual({ type: 'doc', content: [] })
  })
})
