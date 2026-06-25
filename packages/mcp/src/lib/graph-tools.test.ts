// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { serialize } from '@nesso-how/vocab-learning'
import {
  buildGraphDocument,
  buildGraphJson,
  newElementId,
  validateGraphJson,
} from './graph-tools.js'

const validDoc = {
  vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
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
        name: 'X',
        concepts: [{ id: 'n1', label: 'A', x: 0, y: 0 }],
        relations: [],
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.warnings.some((w) => w.path === 'vocabulary')).toBe(true)
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
    expect(doc.vocabulary).toEqual({ id: '@nesso-how/vocab-learning', version: '0.1.0' })
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
