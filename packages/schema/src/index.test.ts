// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { deserialize, GRAPH_FORMAT_VERSION, serialize, type GraphDocumentInput } from './index.js'

type TestConceptData = { score?: number; flag?: boolean }
type TestRelationData = { weight?: number }

function makeConcept(id: string, data?: Partial<TestConceptData>) {
  return { id, label: id, x: 0, y: 0, ...(data && { data: { ...data } }) }
}

function makeRelation(id: string, source: string, target: string, type = 'causes') {
  return { id, source, target, type }
}

describe('serialize / deserialize', () => {
  it('round-trips a valid graph document', () => {
    const doc: GraphDocumentInput<TestConceptData, TestRelationData> = {
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      name: 'Demo',
      concepts: [makeConcept('n1'), makeConcept('n2', { score: 1 })],
      relations: [makeRelation('e1', 'n1', 'n2')],
    }
    const parsed = deserialize<TestConceptData, TestRelationData>(serialize(doc))
    expect(parsed.version).toBe(GRAPH_FORMAT_VERSION)
    expect(parsed.vocabulary).toEqual({ id: '@nesso-how/vocab-learning', version: '0.1.0' })
    expect(parsed.name).toBe('Demo')
    expect(parsed.concepts.map((c) => c.id)).toEqual(['n1', 'n2'])
    expect(parsed.relations).toEqual(doc.relations)
  })

  it('produces pretty-printed JSON with version as the first key', () => {
    const json = serialize({ name: 'X', concepts: [], relations: [] })
    expect(json).toContain('\n')
    const parsed = JSON.parse(json)
    expect(parsed).toMatchObject({ version: GRAPH_FORMAT_VERSION, name: 'X' })
    expect(Object.keys(parsed)[0]).toBe('version')
  })

  it('writes vocabulary after version when present', () => {
    const json = serialize({
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      name: 'X',
      concepts: [],
      relations: [],
    })
    const keys = Object.keys(JSON.parse(json))
    expect(keys.slice(0, 2)).toEqual(['version', 'vocabulary'])
  })

  it('emits optional envelope keys in stable order when present', () => {
    const json = serialize({
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      name: 'X',
      concepts: [],
      relations: [],
      meta: { display: {} },
    })
    const parsed = JSON.parse(json)
    expect(Object.keys(parsed)).toEqual([
      'version',
      'vocabulary',
      'name',
      'concepts',
      'relations',
      'meta',
    ])
    expect(parsed).toMatchObject({ meta: { display: {} } })
  })

  it('defaults missing version to the current format version', () => {
    const json = JSON.stringify({ name: 'Old', concepts: [], relations: [] })
    expect(deserialize(json).version).toBe(GRAPH_FORMAT_VERSION)
  })

  it('throws on an unsupported version', () => {
    const json = JSON.stringify({ version: 99, name: 'Future', concepts: [], relations: [] })
    expect(() => deserialize(json)).toThrow(/Unsupported Nesso graph document version: 99/)
  })

  it('round-trips relation data', () => {
    const doc: GraphDocumentInput = {
      name: 'R',
      concepts: [makeConcept('n1')],
      relations: [
        { id: 'e1', source: 'n1', target: 'n1', type: 'causes', data: { curveFlip: true } },
      ],
    }
    const parsed = deserialize(serialize(doc))
    expect(parsed.relations[0].data).toEqual({ curveFlip: true })
  })
})

describe('deserialize validation', () => {
  it('rejects a file missing the concepts/relations arrays', () => {
    expect(() => deserialize('{}')).toThrow(/missing concepts or relations/)
    expect(() => deserialize(JSON.stringify({ concepts: [] }))).toThrow(
      /missing concepts or relations/,
    )
  })

  it('rejects a non-object root', () => {
    expect(() => deserialize('null')).toThrow(/missing concepts or relations/)
    expect(() => deserialize('42')).toThrow(/missing concepts or relations/)
  })

  it('rejects a concept entry that is not an object', () => {
    const json = JSON.stringify({ concepts: ['oops'], relations: [] })
    expect(() => deserialize(json)).toThrow(/concept 0 is missing a valid id, label, or position/)
  })

  it('rejects a concept without a valid id, label or position', () => {
    const noId = JSON.stringify({ concepts: [{ label: 'x', x: 0, y: 0 }], relations: [] })
    expect(() => deserialize(noId)).toThrow(/concept 0 is missing a valid id, label, or position/)

    const emptyId = JSON.stringify({
      concepts: [{ id: '', label: 'x', x: 0, y: 0 }],
      relations: [],
    })
    expect(() => deserialize(emptyId)).toThrow(
      /concept 0 is missing a valid id, label, or position/,
    )

    const nanPos = JSON.stringify({
      concepts: [{ id: 'n1', label: 'x', x: Number.NaN, y: 0 }],
      relations: [],
    })
    expect(() => deserialize(nanPos)).toThrow(/concept 0 is missing a valid id, label, or position/)
  })

  it('rejects a relation that is not an object or is missing id, source or target', () => {
    const base = { concepts: [{ id: 'n1', label: 'n1', x: 0, y: 0 }] }
    const cases = [
      [null],
      [{ source: 'n1', target: 'n1' }],
      [{ id: 'e1', target: 'n1' }],
      [{ id: 'e1', source: 'n1' }],
    ]
    for (const relations of cases) {
      const json = JSON.stringify({ ...base, relations })
      expect(() => deserialize(json)).toThrow(/relation 0 is missing id, source or target/)
    }
  })
})
