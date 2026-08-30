// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import {
  NOTES_MAX_DEPTH,
  NOTES_MAX_SERIALIZED_CHARS,
  countNotesWords,
  isEmptyNotesDocument,
  isValidNotesDocument,
  notesToPlainText,
  paragraphNotesFromPlainText,
} from './notes.js'
import type { NotesDocument } from './graphDocument.js'

const doc = (content: unknown[]): NotesDocument => ({ type: 'doc', content }) as NotesDocument

const paragraph = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
})

describe('isValidNotesDocument', () => {
  it('accepts a doc with known and unknown block types (block-agnostic)', () => {
    expect(
      isValidNotesDocument(doc([paragraph('a'), { type: 'callout', content: [paragraph('b')] }])),
    ).toBe(true)
  })

  it('rejects non-objects, wrong type, and missing content array', () => {
    expect(isValidNotesDocument(null)).toBe(false)
    expect(isValidNotesDocument('doc')).toBe(false)
    expect(isValidNotesDocument({ type: 'paragraph', content: [] })).toBe(false)
    expect(isValidNotesDocument({ type: 'doc' })).toBe(false)
    expect(isValidNotesDocument({ type: 'doc', content: 'nope' })).toBe(false)
  })

  it('rejects documents nested deeper than NOTES_MAX_DEPTH', () => {
    let node: Record<string, unknown> = { type: 'text', text: 'deep' }
    for (let i = 0; i < NOTES_MAX_DEPTH + 2; i++) {
      node = { type: 'wrapper', content: [node] }
    }
    expect(isValidNotesDocument(doc([node]))).toBe(false)
  })

  it('rejects documents serialized beyond NOTES_MAX_SERIALIZED_CHARS', () => {
    const huge = doc([paragraph('x'.repeat(NOTES_MAX_SERIALIZED_CHARS))])
    expect(isValidNotesDocument(huge)).toBe(false)
  })

  it('returns false instead of throwing for cyclic or otherwise non-serializable input', () => {
    const cyclic = doc([]) as unknown as Record<string, unknown>
    cyclic.self = cyclic
    expect(() => isValidNotesDocument(cyclic)).not.toThrow()
    expect(isValidNotesDocument(cyclic)).toBe(false)

    const withBigInt = doc([{ type: 'metadata', value: BigInt(1) }])
    expect(() => isValidNotesDocument(withBigInt)).not.toThrow()
    expect(isValidNotesDocument(withBigInt)).toBe(false)

    const withThrowingToJson = doc([]) as unknown as Record<string, unknown>
    withThrowingToJson.toJSON = () => {
      throw new Error('not serializable')
    }
    expect(() => isValidNotesDocument(withThrowingToJson)).not.toThrow()
    expect(isValidNotesDocument(withThrowingToJson)).toBe(false)
  })

  it('returns false instead of throwing for excessively deep input', () => {
    let node: Record<string, unknown> = { type: 'text', text: 'deep' }
    for (let i = 0; i < 20_000; i++) {
      node = { type: 'wrapper', content: [node] }
    }
    const deeplyNested = doc([node])
    expect(() => isValidNotesDocument(deeplyNested)).not.toThrow()
    expect(isValidNotesDocument(deeplyNested)).toBe(false)
  })
})

describe('notesToPlainText', () => {
  it('returns "" for undefined and for a doc with no text', () => {
    expect(notesToPlainText(undefined)).toBe('')
    expect(notesToPlainText(doc([]))).toBe('')
    expect(notesToPlainText(doc([{ type: 'horizontalRule' }]))).toBe('')
  })

  it('joins blocks with newlines and concatenates inline text', () => {
    const notes = doc([
      paragraph('First line'),
      {
        type: 'callout',
        content: [paragraph('Callout body'), { type: 'horizontalRule' }],
      },
    ])
    expect(notesToPlainText(notes as NotesDocument)).toBe('First line\nCallout body')
  })

  it('flattens unknown nested block types to their text (degradation-safe)', () => {
    const notes = doc([
      { type: 'futureBlock', content: [paragraph('inside future')] },
      paragraph('after'),
    ])
    expect(notesToPlainText(notes as NotesDocument)).toBe('inside future\nafter')
  })

  it('preserves direct string text on unknown leaf nodes', () => {
    expect(notesToPlainText(doc([{ type: 'futureLeaf', text: 'direct text' }]))).toBe('direct text')
  })
})

describe('countNotesWords', () => {
  it('counts whitespace-separated words across blocks', () => {
    expect(countNotesWords(doc([paragraph('one two'), paragraph('three')]))).toBe(3)
    expect(countNotesWords(undefined)).toBe(0)
    expect(countNotesWords(doc([{ type: 'horizontalRule' }]))).toBe(0)
  })
})

describe('isEmptyNotesDocument', () => {
  it('is true for undefined, empty, and text-free documents', () => {
    expect(isEmptyNotesDocument(undefined)).toBe(true)
    expect(isEmptyNotesDocument(doc([]))).toBe(true)
    expect(isEmptyNotesDocument(doc([paragraph('   ')]))).toBe(true)
  })

  it('is false when any text exists', () => {
    expect(isEmptyNotesDocument(doc([paragraph('note')]))).toBe(false)
  })
})

describe('paragraphNotesFromPlainText', () => {
  it('converts plain text to a minimal paragraph document', () => {
    expect(paragraphNotesFromPlainText('hello')).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }],
    })
  })

  it('returns undefined for empty or whitespace-only text', () => {
    expect(paragraphNotesFromPlainText('')).toBeUndefined()
    expect(paragraphNotesFromPlainText('   \n ')).toBeUndefined()
  })
})
