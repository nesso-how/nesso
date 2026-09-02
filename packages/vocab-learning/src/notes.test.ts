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

  it('accepts empty editor blocks and supported atom leaves', () => {
    expect(isValidNotesDocument(doc([{ type: 'paragraph' }]))).toBe(true)
    expect(isValidNotesDocument(doc([{ type: 'heading' }]))).toBe(true)
    expect(isValidNotesDocument(doc([{ type: 'codeBlock' }]))).toBe(true)
    expect(isValidNotesDocument(doc([{ type: 'hardBreak' }]))).toBe(true)
    expect(isValidNotesDocument(doc([{ type: 'horizontalRule' }]))).toBe(true)
    expect(
      isValidNotesDocument(
        doc([{ type: 'callout', content: [paragraph('body')] }, { type: 'paragraph' }]),
      ),
    ).toBe(true)
  })

  it('rejects non-objects, wrong type, and non-array content', () => {
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

  it('rejects null, array, or primitive elements inside any content array', () => {
    expect(isValidNotesDocument(doc([null]))).toBe(false)
    expect(isValidNotesDocument(doc(['x']))).toBe(false)
    expect(isValidNotesDocument(doc([42]))).toBe(false)
    expect(isValidNotesDocument(doc([[paragraph('nested array')]]))).toBe(false)
    // Mixed: one valid element cannot rescue a malformed sibling.
    expect(isValidNotesDocument(doc([paragraph('ok'), null]))).toBe(false)
    // The check applies at every nesting level, not just the root.
    expect(isValidNotesDocument(doc([{ type: 'callout', content: [null] }]))).toBe(false)
  })

  it('accepts unknown typed blocks with optional attrs, marks, and nested content', () => {
    expect(
      isValidNotesDocument(
        doc([
          paragraph('a'),
          {
            type: 'futureBlock',
            attrs: { tone: 'quiet' },
            content: [{ type: 'text', text: 'b', marks: [{ type: 'bold' }] }],
          },
        ]),
      ),
    ).toBe(true)
  })

  it('accepts every mark provided by the editor StarterKit schema', () => {
    expect(
      isValidNotesDocument(
        doc([
          paragraph('bold'),
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'all marks',
                marks: [
                  { type: 'bold' },
                  { type: 'italic' },
                  { type: 'strike' },
                  { type: 'code' },
                  { type: 'underline' },
                  { type: 'link', attrs: { href: 'https://example.com' } },
                ],
              },
            ],
          },
        ]),
      ),
    ).toBe(true)
  })

  it('rejects unknown, malformed, or misplaced marks', () => {
    const markedText = (mark: unknown) =>
      paragraph('marked').content.map((node) => ({ ...node, marks: [mark] }))

    expect(isValidNotesDocument(doc([paragraph('ok')]))).toBe(true)
    expect(
      isValidNotesDocument(
        doc([{ type: 'paragraph', content: markedText({ type: 'futureMark' }) }]),
      ),
    ).toBe(false)
    expect(
      isValidNotesDocument(doc([{ type: 'paragraph', content: markedText({ type: 42 }) }])),
    ).toBe(false)
    expect(
      isValidNotesDocument(
        doc([{ type: 'paragraph', content: markedText({ type: 'bold', attrs: null }) }]),
      ),
    ).toBe(false)
    expect(
      isValidNotesDocument(
        doc([{ type: 'paragraph', content: markedText({ type: 'bold', attrs: [] }) }]),
      ),
    ).toBe(false)
    expect(
      isValidNotesDocument(
        doc([{ type: 'paragraph', marks: [{ type: 'bold' }], content: [paragraph('block')] }]),
      ),
    ).toBe(false)
  })

  it('rejects unknown leaves without content', () => {
    expect(isValidNotesDocument(doc([{ type: 'futureLeaf' }]))).toBe(false)
  })

  it('rejects nested documents and empty text nodes', () => {
    expect(isValidNotesDocument(doc([{ type: 'doc', content: [] }]))).toBe(false)
    expect(isValidNotesDocument(doc([paragraph('')]))).toBe(false)
  })

  it('rejects malformed root and content-node fields recursively', () => {
    expect(isValidNotesDocument({ type: 'doc', text: 'root text' })).toBe(false)
    expect(isValidNotesDocument({ type: 'doc', content: undefined })).toBe(false)
    expect(isValidNotesDocument({ type: 'doc', content: [{ type: '' }] })).toBe(false)
    expect(isValidNotesDocument({ type: 'doc', content: [{ type: 42 }] })).toBe(false)
    expect(isValidNotesDocument({ type: 'doc', content: [{ type: undefined }] })).toBe(false)
    expect(isValidNotesDocument({ type: 'doc', content: [{}] })).toBe(false)
    expect(isValidNotesDocument({ type: 'doc', content: [{ type: 'text' }] })).toBe(false)
    expect(isValidNotesDocument({ type: 'doc', content: [{ type: 'text', text: 42 }] })).toBe(false)
    expect(
      isValidNotesDocument({ type: 'doc', content: [{ type: 'text', text: 'x', content: [] }] }),
    ).toBe(false)
    expect(
      isValidNotesDocument({ type: 'doc', content: [{ type: 'paragraph', text: 'inline' }] }),
    ).toBe(false)
    expect(
      isValidNotesDocument({
        type: 'doc',
        content: [{ type: 'paragraph', content: 'not an array' }],
      }),
    ).toBe(false)
    expect(
      isValidNotesDocument({ type: 'doc', content: [{ type: 'paragraph', content: [null] }] }),
    ).toBe(false)
    expect(
      isValidNotesDocument({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ok' }, { type: 'text' }] }],
      }),
    ).toBe(false)
    expect(isValidNotesDocument({ type: 'doc', content: [new Date()] })).toBe(false)
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
