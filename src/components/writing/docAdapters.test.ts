// SPDX-License-Identifier: MIT
import { Editor, type JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { isValidNotesDocument } from '@nesso-how/vocab-learning'
import { describe, expect, it } from 'vitest'
import { NOTES_MAX_SERIALIZED_CHARS, type NotesDocument } from '@/types/graph'
import { asNotesDocument, commitDoc, toEditableDoc } from './docAdapters'
import { Callout } from './extensions/callout'
import { Example } from './extensions/example'

// The degradation boundary is exercised exactly as production enters it:
// editor-shaped JSON (which may contain block types the current vocabulary
// does not know yet) goes through the structural `asNotesDocument` adapter
// before `toEditableDoc`. Fixtures are typed `JSONContent`, so no casts.
const toEditable = (doc: JSONContent) => toEditableDoc(asNotesDocument(doc))

const paragraph = (text: string): JSONContent => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
})

function expectTipTapSafe(node: JSONContent, root = true): void {
  if (!root) expect(node.type).not.toBe('doc')
  if (node.type === 'text') expect(node.text).not.toBe('')
  for (const child of node.content ?? []) expectTipTapSafe(child, false)
}

function createWritingEditor(content: JSONContent): Editor {
  return new Editor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), Callout, Example],
    content,
  })
}

describe('toEditableDoc', () => {
  it('normalizes a document without optional content to an empty editable document', () => {
    expect(toEditable({ type: 'doc' })).toEqual({ type: 'doc', content: [] })
  })

  it('does not degrade structurally invalid direct text nodes', () => {
    const persisted: JSONContent = {
      type: 'doc',
      content: [{ type: 'futureBlock', text: 'not valid' }],
    }

    expect(isValidNotesDocument(persisted)).toBe(false)
    expect(toEditable(persisted)).toEqual({ type: 'doc', content: [] })
  })

  it.each([
    'toString',
    '__proto__',
    'constructor',
  ])('degrades inherited normalizer name %s as an unknown block', (type) => {
    const persisted: JSONContent = {
      type: 'doc',
      content: [{ type, content: [{ type: 'text', text: `inside ${type}` }] }],
    }

    expect(isValidNotesDocument(persisted)).toBe(true)
    expect(toEditable(persisted)).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: `inside ${type}` }] }],
    })
  })

  it('degrades unknown block types to paragraphs with their text', () => {
    const doc = toEditable({
      type: 'doc',
      content: [
        {
          type: 'futureBlock',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'keep me' }] }],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'after' }] },
      ],
    })
    expect(doc.content?.[0]?.type).toBe('paragraph')
    expect(JSON.stringify(doc)).toContain('keep me')
    expect(JSON.stringify(doc)).not.toContain('futureBlock')
  })

  it('keeps known block types untouched', () => {
    const doc = toEditable({
      type: 'doc',
      content: [
        {
          type: 'callout',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'c' }] }],
        },
      ],
    })
    expect(doc.content?.[0]?.type).toBe('callout')
  })

  it('keeps validator-accepted empty blocks and unknown containers safe for TipTap', () => {
    const persisted: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph' },
        { type: 'heading' },
        { type: 'codeBlock' },
        { type: 'hardBreak' },
        { type: 'horizontalRule' },
        {
          type: 'futureBlock',
          attrs: { tone: 'quiet' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'body' }] }],
        },
      ],
    }

    expect(isValidNotesDocument(persisted)).toBe(true)
    const editable = toEditable(persisted)
    expectTipTapSafe(editable)
    expect(editable.content).toEqual([
      { type: 'paragraph', content: [] },
      { type: 'heading', attrs: { level: 2 }, content: [] },
      { type: 'codeBlock', attrs: { language: null } },
      { type: 'paragraph', content: [{ type: 'hardBreak' }] },
      { type: 'horizontalRule' },
      { type: 'paragraph', content: [{ type: 'text', text: 'body' }] },
    ])
  })

  it('preserves text nested under atom-shaped nodes while making them schema-safe', () => {
    const persisted: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'horizontalRule',
          content: [{ type: 'futureBlock', content: [{ type: 'text', text: 'after rule' }] }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'hardBreak',
              content: [{ type: 'futureInline', content: [{ type: 'text', text: 'after break' }] }],
            },
          ],
        },
      ],
    }

    expect(isValidNotesDocument(persisted)).toBe(true)
    const editable = toEditable(persisted)
    expectTipTapSafe(editable)
    expect(JSON.stringify(editable)).toContain('after rule')
    expect(JSON.stringify(editable)).toContain('after break')

    const editor = createWritingEditor(editable)
    try {
      expect(() => editor.state.doc.check()).not.toThrow()
      expect(editor.getText()).toContain('after rule')
      expect(editor.getText()).toContain('after break')
    } finally {
      editor.destroy()
    }
  })

  it.each([
    {
      name: 'a bullet list with a paragraph child',
      persisted: {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'list text' }] }],
          },
        ],
      },
      text: 'list text',
    },
    {
      name: 'a list item with direct text',
      persisted: {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [{ type: 'listItem', content: [{ type: 'text', text: 'item text' }] }],
          },
        ],
      },
      text: 'item text',
    },
    {
      name: 'a code block containing a paragraph',
      persisted: {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'code text' }] }],
          },
        ],
      },
      text: 'code text',
    },
    {
      name: 'a known block at an inline position',
      persisted: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'before ' },
              {
                type: 'bulletList',
                content: [
                  {
                    type: 'listItem',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'nested' }] }],
                  },
                ],
              },
              { type: 'text', text: ' after' },
            ],
          },
        ],
      },
      text: 'nested',
    },
  ])('normalizes $name against the actual editor schema', ({ persisted, text }) => {
    expect(isValidNotesDocument(persisted)).toBe(true)
    let rawEditor: Editor | undefined
    try {
      rawEditor = createWritingEditor(persisted)
      expect(() => rawEditor?.state.doc.check()).toThrow()
    } finally {
      rawEditor?.destroy()
    }
    const editable = toEditable(persisted)
    let editor: Editor | undefined
    try {
      expect(() => {
        editor = createWritingEditor(editable)
      }).not.toThrow()
      const initialized = editor
      if (initialized === undefined) throw new Error('expected editor to initialize')
      expect(() => initialized.state.doc.check()).not.toThrow()
      expect(initialized.getText()).toContain(text)
    } finally {
      editor?.destroy()
    }
  })

  it('keeps valid lists, callouts, examples, and code blocks in the editor schema', () => {
    const persisted: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [paragraph('bullet')] }],
        },
        {
          type: 'orderedList',
          attrs: { order: 3 },
          content: [{ type: 'listItem', content: [paragraph('ordered')] }],
        },
        { type: 'callout', content: [paragraph('callout')] },
        { type: 'example', content: [paragraph('example')] },
        { type: 'codeBlock', attrs: { language: 'ts' }, content: [{ type: 'text', text: 'code' }] },
      ],
    }
    const editable = toEditable(persisted)
    let editor: Editor | undefined
    try {
      editor = createWritingEditor(editable)
      expect(() => editor?.state.doc.check()).not.toThrow()
      expect(editor?.getText()).toEqual(expect.stringContaining('bullet'))
      expect(editor?.getText()).toEqual(expect.stringContaining('ordered'))
      expect(editor?.getText()).toEqual(expect.stringContaining('callout'))
      expect(editor?.getText()).toEqual(expect.stringContaining('example'))
      expect(editor?.getText()).toEqual(expect.stringContaining('code'))
    } finally {
      editor?.destroy()
    }
  })
})

describe('toEditableDoc — lossless degradation', () => {
  it('keeps only code when code is combined with other marks', () => {
    const doc = toEditable({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'code wins',
              marks: [
                { type: 'bold' },
                { type: 'code' },
                { type: 'italic' },
                { type: 'strike' },
                { type: 'underline' },
                { type: 'link', attrs: { href: 'https://example.com' } },
              ],
            },
          ],
        },
      ],
    })

    expect(doc.content?.[0]?.content?.[0]).toEqual({
      type: 'text',
      text: 'code wins',
      marks: [{ type: 'code' }],
    })
  })

  it('deduplicates marks in first-seen order and deep-copies the first attrs', () => {
    const sourceMarks: NonNullable<JSONContent['marks']> = [
      { type: 'bold' },
      { type: 'bold' },
      { type: 'link', attrs: { href: 'https://first.example.com', title: 'first' } },
      { type: 'link', attrs: { href: 'https://second.example.com', title: 'second' } },
    ]
    const doc = toEditable({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'marked', marks: sourceMarks }] },
      ],
    })
    const text = doc.content?.[0]?.content?.[0]
    if (!text?.marks) throw new Error('expected normalized marks')

    expect(text.marks).toEqual([
      { type: 'bold' },
      { type: 'link', attrs: { href: 'https://first.example.com', title: 'first' } },
    ])
    expect(text.marks).not.toBe(sourceMarks)
    expect(text.marks[1]?.attrs).not.toBe(sourceMarks[2]?.attrs)

    text.marks[1]!.attrs!.href = 'https://changed.example.com'
    expect(sourceMarks[2]?.attrs).toEqual({ href: 'https://first.example.com', title: 'first' })
  })

  it('keeps an ordinary set of distinct marks unchanged', () => {
    const marks: NonNullable<JSONContent['marks']> = [
      { type: 'bold' },
      { type: 'italic' },
      { type: 'strike' },
      { type: 'underline' },
      { type: 'link', attrs: { href: 'https://example.com' } },
    ]
    const doc = toEditable({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'marked', marks }] }],
    })

    expect(doc.content?.[0]?.content?.[0]?.marks).toEqual(marks)
  })

  it('preserves adjacent marked text verbatim inside unknown blocks (no join, no trim)', () => {
    const doc = toEditable({
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
    })
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
    const doc = toEditable({
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
    })
    expect(doc.content?.[0]?.content).toEqual([
      { type: 'text', text: 'ab' },
      { type: 'text', text: 'cd' },
    ])
  })

  it('splits unknown block content into separate paragraphs at block boundaries', () => {
    const doc = toEditable({
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
    })
    expect(doc.content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'two' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'three' }] },
    ])
  })

  it('keeps inline runs and nested blocks as distinct paragraphs inside unknown blocks', () => {
    const doc = toEditable({
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
    })
    expect(doc.content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'intro' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'body' }] },
    ])
  })

  it('degrades nested unknown blocks at their boundaries', () => {
    const doc = toEditable({
      type: 'doc',
      content: [
        {
          type: 'futureOuter',
          content: [{ type: 'futureInner', content: [{ type: 'text', text: 'deep' }] }],
        },
      ],
    })
    expect(doc.content).toEqual([{ type: 'paragraph', content: [{ type: 'text', text: 'deep' }] }])
  })

  it('passes known paragraph inline content through verbatim (hardBreak, spacing, marks)', () => {
    const doc = toEditable({
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
    })
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
    const doc = toEditable({ type: 'doc', content: [{ type: 'futureEmpty' }] })
    expect(doc.content).toEqual([])
  })

  it('deep-copies marks on pass-through text nodes sharing one source array', () => {
    const marks: NonNullable<JSONContent['marks']> = [
      { type: 'link', attrs: { href: 'https://example.com', title: 'source' } },
    ]
    const doc = toEditable({
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
    })

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
    const firstAttrs = first.marks[0].attrs as { href: string }
    firstAttrs.href = 'https://changed.example.com'
    expect(marks).toHaveLength(1)
    expect(marks[0].type).toBe('link')
    expect((marks[0].attrs as { href: string }).href).toBe('https://example.com')

    // The second copy is untouched by mutations to the first.
    expect(second.marks).toHaveLength(1)
    expect(second.marks[0].type).toBe('link')
    expect((second.marks[0].attrs as { href: string }).href).toBe('https://example.com')
  })
})

describe('commitDoc', () => {
  it('canonicalizes empty documents to undefined', () => {
    expect(commitDoc(undefined)).toBeUndefined()
    expect(commitDoc({ type: 'doc', content: [] })).toBeUndefined()
    expect(commitDoc({ type: 'doc', content: [{ type: 'paragraph' }] })).toBeUndefined()
  })

  it('keeps documents with text', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
    }
    expect(commitDoc(doc)).toEqual(doc)
  })

  describe('commit-time caps (fall back to the last valid document)', () => {
    const lastValid: NotesDocument = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'kept' }] }],
    }

    it('falls back when the outgoing document exceeds the serialized-size cap (oversize paste)', () => {
      const oversized: JSONContent = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(100_001) }] }],
      }
      expect(JSON.stringify(oversized).length).toBeGreaterThan(NOTES_MAX_SERIALIZED_CHARS)
      expect(commitDoc(oversized, lastValid)).toEqual(lastValid)
    })

    it('falls back when the outgoing document exceeds the depth cap (pathological nesting)', () => {
      let deep: JSONContent = { type: 'text', text: 'deep' }
      for (let i = 0; i < 12; i++) {
        deep = { type: 'wrapper', content: [deep] }
      }
      const doc: JSONContent = { type: 'doc', content: [deep] }
      expect(commitDoc(doc, lastValid)).toEqual(lastValid)
    })

    it('returns undefined when the document violates a cap and no valid document exists', () => {
      const oversized: JSONContent = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(100_001) }] }],
      }
      expect(commitDoc(oversized)).toBeUndefined()
    })

    it('still canonicalizes empty documents to undefined even with a fallback', () => {
      expect(commitDoc({ type: 'doc', content: [] }, lastValid)).toBeUndefined()
    })

    it('falls back for malformed cyclic input before trying to flatten it', () => {
      const cyclic: JSONContent = { type: 'doc', content: [] }
      cyclic.content?.push(cyclic)

      expect(commitDoc(cyclic, lastValid)).toEqual(lastValid)
    })

    it('passes valid non-empty documents through untouched', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'fresh' }] }],
      }
      expect(commitDoc(doc, lastValid)).toEqual({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'fresh' }] }],
      })
    })
  })
})

describe('asNotesDocument', () => {
  it('casts editor JSONContent into the vocabulary NotesDocument shape', () => {
    const json: JSONContent = { type: 'doc', content: [] }
    expect(asNotesDocument(json)).toEqual({ type: 'doc', content: [] })
  })
})
