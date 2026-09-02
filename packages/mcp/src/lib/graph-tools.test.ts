// SPDX-License-Identifier: MIT
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GRAPH_FORMAT_VERSION } from '@nesso-how/schema'
import { serialize, VOCABULARY } from '@nesso-how/vocab-learning'
import {
  buildGraphDocument,
  buildGraphInputSchema,
  buildGraphJson,
  newElementId,
  validateGraphJson,
} from './graph-tools.js'

const validDoc = {
  vocabulary: { id: '@nesso-how/vocab-learning', version: VOCABULARY.version },
  name: 'Demo',
  concepts: [
    { id: 'n1', label: 'Cause', x: 0, y: 0 },
    { id: 'n2', label: 'Effect', x: 250, y: 0 },
  ],
  relations: [{ id: 'e1', source: 'n1', target: 'n2', type: 'causes' as const }],
}

describe('validateGraphJson', () => {
  it('accepts a valid graph document', () => {
    const result = validateGraphJson(serialize(validDoc))
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects invalid JSON', () => {
    const result = validateGraphJson('{not json')
    expect(result.valid).toBe(false)
    expect(result.errors[0]?.message).toMatch(/Invalid JSON/)
  })

  it('rejects runtime nodes/edges shape', () => {
    const result = validateGraphJson(
      JSON.stringify({
        nodes: [{ id: 'n1' }],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors[0]?.message).toMatch(/concepts\[\] and relations\[\]/)
  })

  it('rejects unknown relation types', () => {
    const result = validateGraphJson(
      JSON.stringify({
        version: GRAPH_FORMAT_VERSION,
        vocabulary: { id: '@nesso-how/vocab-learning', version: VOCABULARY.version },
        name: 'X',
        concepts: [{ id: 'n1', label: 'A', x: 0, y: 0 }],
        relations: [{ id: 'e1', source: 'n1', target: 'n1', type: 'not-real' }],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors[0]?.message).toMatch(/unknown relation type/)
  })

  it('rejects duplicate concept ids', () => {
    const result = validateGraphJson(
      JSON.stringify({
        version: GRAPH_FORMAT_VERSION,
        vocabulary: { id: '@nesso-how/vocab-learning', version: VOCABULARY.version },
        name: 'X',
        concepts: [
          { id: 'n1', label: 'A', x: 0, y: 0 },
          { id: 'n1', label: 'B', x: 100, y: 0 },
        ],
        relations: [],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('Duplicate concept id'))).toBe(true)
  })

  it('rejects dangling relation endpoints', () => {
    const result = validateGraphJson(
      JSON.stringify({
        version: GRAPH_FORMAT_VERSION,
        vocabulary: { id: '@nesso-how/vocab-learning', version: VOCABULARY.version },
        name: 'X',
        concepts: [{ id: 'n1', label: 'A', x: 0, y: 0 }],
        relations: [{ id: 'e1', source: 'n1', target: 'missing', type: 'causes' }],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.path.includes('target'))).toBe(true)
  })

  it('warns when relation type is omitted', () => {
    const result = validateGraphJson(
      JSON.stringify({
        version: GRAPH_FORMAT_VERSION,
        vocabulary: { id: '@nesso-how/vocab-learning', version: VOCABULARY.version },
        name: 'X',
        concepts: [
          { id: 'n1', label: 'A', x: 0, y: 0 },
          { id: 'n2', label: 'B', x: 100, y: 0 },
        ],
        relations: [{ id: 'e1', source: 'n1', target: 'n2' }],
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.warnings.some((w) => w.path.includes('type'))).toBe(true)
  })

  it('warns when vocabulary is missing', () => {
    const result = validateGraphJson(
      JSON.stringify({
        version: GRAPH_FORMAT_VERSION,
        name: 'X',
        concepts: [{ id: 'n1', label: 'A', x: 0, y: 0 }],
        relations: [],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('vocabulary'))).toBe(true)
  })
})

describe('buildGraphDocument', () => {
  it('builds a document that passes validation', () => {
    const json = buildGraphJson({
      name: 'Built',
      concepts: ['Cause', 'Effect'],
      relations: [{ from: 'Cause', to: 'Effect', relation: 'causes' }],
    })
    const result = validateGraphJson(json)
    expect(result.valid).toBe(true)
  })

  it('resolves from/to by concept id', () => {
    const doc = buildGraphDocument({
      name: 'Refs',
      concepts: [{ id: 'n_alpha', text: 'Alpha' }, 'Beta'],
      relations: [{ from: 'n_alpha', to: 'Beta', relation: 'enables' }],
    })
    expect(doc.relations[0]?.source).toBe('n_alpha')
    expect(doc.relations[0]?.type).toBe('enables')
  })

  it('assigns finite layout coordinates', () => {
    const doc = buildGraphDocument({
      name: 'Layout',
      concepts: ['A', 'B', 'C', 'D'],
      relations: [
        { from: 'A', to: 'B', relation: 'causes' },
        { from: 'B', to: 'C', relation: 'causes' },
        { from: 'C', to: 'D', relation: 'causes' },
      ],
    })
    for (const concept of doc.concepts) {
      expect(Number.isFinite(concept.x)).toBe(true)
      expect(Number.isFinite(concept.y)).toBe(true)
    }
    const xs = doc.concepts.map((c) => c.x)
    expect(new Set(xs).size).toBeGreaterThan(1)
  })

  it('includes vocabulary metadata', () => {
    const doc = buildGraphDocument({
      name: 'Meta',
      concepts: ['Only'],
      relations: [],
    })
    expect(doc.vocabulary).toEqual({ id: '@nesso-how/vocab-learning', version: VOCABULARY.version })
  })

  it('rejects ambiguous label references', () => {
    expect(() =>
      buildGraphDocument({
        name: 'Ambiguous',
        concepts: ['Same', 'Same'],
        relations: [{ from: 'Same', to: 'Same', relation: 'causes' }],
      }),
    ).toThrow(/Ambiguous concept reference/)
  })

  it('rejects unknown references', () => {
    expect(() =>
      buildGraphDocument({
        name: 'Missing',
        concepts: ['A'],
        relations: [{ from: 'A', to: 'Z', relation: 'causes' }],
      }),
    ).toThrow(/Unknown concept reference/)
  })
})

describe('notes plain-text boundary', () => {
  it('accepts the documented elaboration shape (definition + plain-text notes)', () => {
    const result = buildGraphInputSchema.safeParse({
      name: 'Notes',
      concepts: [{ text: 'A', elaboration: { definition: 'd', notes: 'Plain text note' } }],
      relations: [],
    })
    expect(result.success).toBe(true)
  })

  it('rejects legacy elaboration keys (examples, image) instead of silently stripping them', () => {
    const legacy = buildGraphInputSchema.safeParse({
      name: 'Notes',
      concepts: [
        { text: 'A', elaboration: { definition: 'd', notes: 'n', examples: ['legacy example'] } },
      ],
      relations: [],
    })
    expect(legacy.success).toBe(false)
    if (!legacy.success) {
      expect(JSON.stringify(legacy.error.issues)).toMatch(/examples/)
    }

    const image = buildGraphInputSchema.safeParse({
      name: 'Notes',
      concepts: [{ text: 'A', elaboration: { definition: 'd', image: 'data:image/png;base64,x' } }],
      relations: [],
    })
    expect(image.success).toBe(false)
    if (!image.success) {
      expect(JSON.stringify(image.error.issues)).toMatch(/image/)
    }
  })

  it('build_graph converts a plain-string note to a minimal paragraph document', () => {
    const doc = buildGraphDocument({
      name: 'Notes',
      concepts: [{ text: 'A', elaboration: { definition: 'd', notes: 'Plain text note' } }],
      relations: [],
    })
    const elab = doc.concepts[0]?.data?.elaboration
    expect(elab?.notes).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Plain text note' }] }],
    })
    expect(validateGraphJson(serialize(doc)).valid).toBe(true)
  })

  it('build_graph omits notes for empty or whitespace-only strings', () => {
    const doc = buildGraphDocument({
      name: 'Notes',
      concepts: [{ text: 'A', elaboration: { definition: 'd', notes: '   ' } }],
      relations: [],
    })
    expect(doc.concepts[0]?.data?.elaboration).toEqual({ definition: 'd' })
  })

  it('validate_graph accepts rich notes documents and rejects alpha string notes', () => {
    const base = {
      version: GRAPH_FORMAT_VERSION,
      vocabulary: { id: VOCABULARY.id, version: VOCABULARY.version },
      name: 'X',
      concepts: [
        {
          id: 'n1',
          label: 'A',
          x: 0,
          y: 0,
          data: {
            elaboration: {
              definition: 'd',
              notes: {
                type: 'doc',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'rich' }] }],
              },
            },
          },
        },
      ],
      relations: [],
    }
    expect(validateGraphJson(JSON.stringify(base)).valid).toBe(true)

    const alpha = structuredClone(base)
    ;(alpha.concepts[0].data.elaboration as Record<string, unknown>).notes = 'legacy string'
    const result = validateGraphJson(JSON.stringify(alpha))
    expect(result.valid).toBe(false)
    expect(result.errors[0]?.message).toMatch(/must be a bounded/)
  })
})

describe('concept id boundary', () => {
  it.each(['', '   '])('rejects an explicit %j concept id', (id) => {
    const result = buildGraphInputSchema.safeParse({
      name: 'Ids',
      concepts: [{ id, text: 'A' }],
      relations: [],
    })

    expect(result.success).toBe(false)
  })

  it.each(['', '   '])('rejects an explicit %j concept id while building', (id) => {
    expect(() =>
      buildGraphDocument({
        name: 'Ids',
        concepts: [{ id, text: 'A' }],
        relations: [],
      }),
    ).toThrow(/concept id/i)
  })
})

describe('newElementId', () => {
  it('generates unique ids with the expected prefix', () => {
    const used = new Set<string>()
    const id = newElementId('n', used)
    expect(id.startsWith('n')).toBe(true)
    expect(id.length).toBe(6)
    used.add(id)
    const next = newElementId('n', used)
    expect(next).not.toBe(id)
  })
})

describe('buildGraphDocument relation ids', () => {
  afterEach(() => vi.restoreAllMocks())

  it('keeps generated edge ids unique across many colliding random candidates', () => {
    let randomCalls = 0
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const candidate = Math.floor(randomCalls / 2) + 1
      randomCalls += 1
      return candidate / 1_000
    })

    const relations = Array.from({ length: 128 }, () => ({
      from: 'A',
      to: 'B',
      relation: 'causes' as const,
    }))
    const document = buildGraphDocument({
      name: 'Many relations',
      concepts: [
        { id: 'n1', text: 'A' },
        { id: 'n2', text: 'B' },
      ],
      relations,
    })

    expect(new Set(document.relations.map((relation) => relation.id)).size).toBe(relations.length)
  })
})
