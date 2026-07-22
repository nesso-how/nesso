// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest'
import { VOCABULARY } from '@nesso-how/vocab-learning'
import baseline from './fixtures/graph-load/v1-vocabulary-0.1.0.json'
import {
  GRAPH_RECORD_VERSION,
  normalizeGraphDocument,
  normalizeGraphRecord,
  normalizeParsedGraphDocument,
} from './graphLoadNormalizer'

const identity = { id: 'test-id', createdAt: 1, updatedAt: 1 }

function minimalDoc(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    vocabulary: { id: VOCABULARY.id, version: VOCABULARY.version },
    name: 'Test',
    concepts: [],
    relations: [],
    ...overrides,
  })
}

describe('graph load normalization', () => {
  it('normalizes the released document baseline', () => {
    const record = normalizeGraphDocument(JSON.stringify(baseline), {
      id: 'beta-baseline',
      createdAt: 1,
      updatedAt: 1,
    })

    expect(record.recordVersion).toBe(GRAPH_RECORD_VERSION)
    expect(record.vocabulary).toEqual({
      id: '@nesso-how/vocab-learning',
      version: '0.1.0',
    })
    expect(record.nodes[0]?.data.elaboration).toEqual({
      definition: 'The first protected vocabulary shape.',
    })
  })

  it('replays a current graph record', () => {
    const record = normalizeGraphDocument(JSON.stringify(baseline), {
      id: 'beta-baseline',
      createdAt: 1,
      updatedAt: 1,
    })

    expect(normalizeGraphRecord(record)).toEqual(record)
  })

  it('rejects an unversioned alpha graph record', () => {
    const current = normalizeGraphDocument(JSON.stringify(baseline), {
      id: 'beta-baseline',
      createdAt: 1,
      updatedAt: 1,
    })
    const { recordVersion: _, ...alphaRecord } = current

    expect(() => normalizeGraphRecord(alphaRecord)).toThrow('Unsupported graph-record version')
  })

  it('rejects a graph record from a newer app', () => {
    const current = normalizeGraphDocument(JSON.stringify(baseline), {
      id: 'beta-baseline',
      createdAt: 1,
      updatedAt: 1,
    })

    expect(() =>
      normalizeGraphRecord({
        ...current,
        recordVersion: GRAPH_RECORD_VERSION + 1,
      }),
    ).toThrow('Graph record is from a newer app version')
  })
})

describe('vocabulary compatibility boundary', () => {
  it('rejects a document with a foreign vocabulary id', () => {
    const json = minimalDoc({
      vocabulary: { id: '@example/foreign', version: VOCABULARY.version },
    })

    expect(() => normalizeGraphDocument(json, identity)).toThrow(
      'Unsupported graph vocabulary: @example/foreign',
    )
  })

  it('rejects a document with a newer vocabulary version (forward guard)', () => {
    const json = minimalDoc({
      vocabulary: { id: VOCABULARY.id, version: '0.2.0' },
    })

    expect(() => normalizeGraphDocument(json, identity)).toThrow(
      'Graph document is from a newer vocabulary version: 0.2.0',
    )
  })

  it('rejects a document with an unsupported older vocabulary version (no migration step)', () => {
    const json = minimalDoc({
      vocabulary: { id: VOCABULARY.id, version: '0.0.1' },
    })

    expect(() => normalizeGraphDocument(json, identity)).toThrow(
      'Unsupported learning vocabulary version: 0.0.1',
    )
  })

  it('rejects a document with a missing vocabulary', () => {
    const json = minimalDoc()
    const obj = JSON.parse(json)
    delete obj.vocabulary

    expect(() => normalizeGraphDocument(JSON.stringify(obj), identity)).toThrow(
      'Graph document must declare a vocabulary',
    )
  })

  it.each([
    'examples',
    'notes',
    'imageUrl',
    'imageTitle',
    'imageDescriptionUrl',
  ])('rejects a document with removed alpha elaboration field %s', (field) => {
    const json = minimalDoc({
      concepts: [
        {
          id: 'n1',
          label: 'C',
          x: 0,
          y: 0,
          data: {
            elaboration: {
              definition: 'ok',
              [field]: field === 'examples' ? ['unsupported'] : 'unsupported',
            },
          },
        },
      ],
      relations: [],
    })

    expect(() => normalizeGraphDocument(json, identity)).toThrow(
      'Concept elaboration must contain only definition',
    )
  })
})

describe('normalizeGraphRecord strict shape validation', () => {
  function validRecord(overrides: Record<string, unknown> = {}): unknown {
    return {
      recordVersion: GRAPH_RECORD_VERSION,
      vocabulary: { id: VOCABULARY.id, version: VOCABULARY.version },
      id: 'test-id',
      name: 'Test',
      createdAt: 1,
      updatedAt: 1,
      nodes: [],
      edges: [],
      ...overrides,
    }
  }

  it('rejects a non-object record', () => {
    expect(() => normalizeGraphRecord(null)).toThrow('Invalid graph record')
  })

  it('rejects an array record', () => {
    expect(() => normalizeGraphRecord([])).toThrow('Invalid graph record')
  })

  it('rejects a record missing recordVersion field', () => {
    const { recordVersion: _v, ...missing } = validRecord() as Record<string, unknown>
    expect(() => normalizeGraphRecord(missing)).toThrow('Unsupported graph-record version')
  })

  it('rejects a corrupt IDB record with a foreign vocabulary id', () => {
    const bad = validRecord({
      vocabulary: { id: '@example/foreign', version: VOCABULARY.version },
    })
    expect(() => normalizeGraphRecord(bad)).toThrow('Graph record has an unsupported vocabulary')
  })

  it('rejects a corrupt IDB record with a newer vocabulary version', () => {
    const bad = validRecord({
      vocabulary: { id: VOCABULARY.id, version: '99.0.0' },
    })
    expect(() => normalizeGraphRecord(bad)).toThrow('Graph record has an unsupported vocabulary')
  })

  it('rejects a record with a non-string id', () => {
    const bad = validRecord({ id: 42 })
    expect(() => normalizeGraphRecord(bad)).toThrow('Invalid graph record shape')
  })

  it('rejects a record with a non-string name', () => {
    const bad = validRecord({ name: null })
    expect(() => normalizeGraphRecord(bad)).toThrow('Invalid graph record shape')
  })

  it('rejects a record with non-array nodes', () => {
    const bad = validRecord({ nodes: 'not-an-array' })
    expect(() => normalizeGraphRecord(bad)).toThrow('Invalid graph record shape')
  })

  it('rejects a record with non-array edges', () => {
    const bad = validRecord({ edges: null })
    expect(() => normalizeGraphRecord(bad)).toThrow('Invalid graph record shape')
  })

  it('rejects a record with non-number createdAt', () => {
    const bad = validRecord({ createdAt: 'yesterday' })
    expect(() => normalizeGraphRecord(bad)).toThrow('Invalid graph record shape')
  })

  it('rejects a record with non-number updatedAt', () => {
    const bad = validRecord({ updatedAt: NaN })
    expect(() => normalizeGraphRecord(bad)).toThrow('Invalid graph record shape')
  })

  it('rejects a record with corrupted node data missing text', () => {
    const bad = validRecord({
      nodes: [
        {
          id: 'n1',
          type: 'concept',
          position: { x: 0, y: 0 },
          data: {},
        },
      ],
    })
    expect(() => normalizeGraphRecord(bad)).toThrow('graph record')
  })

  it('rejects a record with node elaboration containing removed alpha "examples" field', () => {
    const bad = validRecord({
      nodes: [
        {
          id: 'n1',
          type: 'concept',
          position: { x: 0, y: 0 },
          data: {
            text: 'C',
            elaboration: { definition: 'ok', examples: ['unsupported'] },
          },
        },
      ],
    })
    expect(() => normalizeGraphRecord(bad)).toThrow('elaboration')
  })

  it('rejects a record with node elaboration containing removed alpha "notes" field', () => {
    const bad = validRecord({
      nodes: [
        {
          id: 'n1',
          type: 'concept',
          position: { x: 0, y: 0 },
          data: {
            text: 'C',
            elaboration: { definition: 'ok', notes: 'unsupported' },
          },
        },
      ],
    })
    expect(() => normalizeGraphRecord(bad)).toThrow('elaboration')
  })

  it('rejects a record with node elaboration containing removed alpha "imageUrl" field', () => {
    const bad = validRecord({
      nodes: [
        {
          id: 'n1',
          type: 'concept',
          position: { x: 0, y: 0 },
          data: {
            text: 'C',
            elaboration: { definition: 'ok', imageUrl: 'unsupported' },
          },
        },
      ],
    })
    expect(() => normalizeGraphRecord(bad)).toThrow('elaboration')
  })

  it('rejects a record with an edge missing the "nesso" type', () => {
    const bad = validRecord({
      nodes: [
        { id: 'n1', type: 'concept', position: { x: 0, y: 0 }, data: { text: 'A' } },
        { id: 'n2', type: 'concept', position: { x: 0, y: 0 }, data: { text: 'B' } },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    })
    expect(() => normalizeGraphRecord(bad)).toThrow('graph record')
  })

  it('rejects a record with an edge data carrying an unknown relation type', () => {
    const bad = validRecord({
      nodes: [
        { id: 'n1', type: 'concept', position: { x: 0, y: 0 }, data: { text: 'A' } },
        { id: 'n2', type: 'concept', position: { x: 0, y: 0 }, data: { text: 'B' } },
      ],
      edges: [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          sourceHandle: 'out',
          targetHandle: 'in',
          type: 'nesso',
          data: { type: 'not-a-valid-relation' },
        },
      ],
    })
    expect(() => normalizeGraphRecord(bad)).toThrow('relation type')
  })

  it('rejects a record with a non-finite createdAt timestamp', () => {
    const bad = validRecord({ createdAt: Infinity })
    expect(() => normalizeGraphRecord(bad)).toThrow('Invalid graph record shape')
  })

  it('rejects a record with a non-finite updatedAt timestamp', () => {
    const bad = validRecord({ updatedAt: Infinity })
    expect(() => normalizeGraphRecord(bad)).toThrow('Invalid graph record shape')
  })

  it('accepts a well-formed record with valid nodes and edges', () => {
    const good = validRecord({
      nodes: [
        {
          id: 'n1',
          type: 'concept',
          position: { x: 10, y: 20 },
          data: { text: 'A', elaboration: { definition: 'First concept.' } },
        },
        {
          id: 'n2',
          type: 'concept',
          position: { x: 30, y: 40 },
          data: { text: 'B' },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          sourceHandle: 'out',
          targetHandle: 'in',
          type: 'nesso',
          data: { type: 'subtype-of' },
        },
      ],
      display: {
        edgeEncoding: 'full',
        showHeatmap: true,
        curveStyle: 'arc',
        autoCurveFlip: false,
      },
    })
    const result = normalizeGraphRecord(good)
    expect(result.id).toBe('test-id')
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
  })
})

describe('normalizeParsedGraphDocument', () => {
  it('normalizes a parsed document without re-serializing', () => {
    const doc = {
      version: 1 as const,
      vocabulary: { id: VOCABULARY.id, version: VOCABULARY.version },
      name: 'Parsed',
      concepts: [],
      relations: [],
    }

    const record = normalizeParsedGraphDocument(doc, {
      id: 'parsed-id',
      createdAt: 1,
      updatedAt: 1,
    })

    expect(record.recordVersion).toBe(GRAPH_RECORD_VERSION)
    expect(record.id).toBe('parsed-id')
    expect(record.name).toBe('Parsed')
  })

  it('rejects a parsed document with a foreign vocabulary', () => {
    const doc = {
      version: 1 as const,
      vocabulary: { id: '@other/vocab', version: '1.0.0' },
      name: 'Bad',
      concepts: [],
      relations: [],
    }

    expect(() =>
      normalizeParsedGraphDocument(doc, { id: 'x', createdAt: 1, updatedAt: 1 }),
    ).toThrow('Unsupported graph vocabulary')
  })
})

// ── Normalizer-owned identity resolution ──

import { tryResolveGraphIdentityFromEnvelope } from './graphLoadNormalizer'

function supportedJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    vocabulary: { id: VOCABULARY.id, version: VOCABULARY.version },
    name: 'Test',
    concepts: [],
    relations: [],
    ...overrides,
  })
}

describe('tryResolveGraphIdentityFromEnvelope', () => {
  it('resolves identity for a valid document', () => {
    const json = supportedJson({ id: 'n0000000000001', name: 'Hello' })

    const result = tryResolveGraphIdentityFromEnvelope(json)

    expect(result).toEqual({ id: 'n0000000000001', name: 'Hello' })
  })

  it('returns null for a document with a foreign vocabulary id', () => {
    const json = supportedJson({
      vocabulary: { id: '@other/vocab', version: '1.0.0' },
    })

    expect(tryResolveGraphIdentityFromEnvelope(json)).toBeNull()
  })

  it('returns null for a document with a newer vocabulary version', () => {
    const json = supportedJson({
      vocabulary: { id: VOCABULARY.id, version: '99.0.0' },
    })

    expect(tryResolveGraphIdentityFromEnvelope(json)).toBeNull()
  })

  it('returns null for a document with no vocabulary', () => {
    const obj = JSON.parse(supportedJson())
    delete obj.vocabulary

    expect(tryResolveGraphIdentityFromEnvelope(JSON.stringify(obj))).toBeNull()
  })

  it('returns null for unparseable JSON', () => {
    expect(tryResolveGraphIdentityFromEnvelope('not json')).toBeNull()
  })
})
