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

  it('emits optional envelope keys in stable order, omitting absent ones', () => {
    // Partial: only vocabulary + meta present (id and updatedAt absent)
    const partial = serialize({
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      name: 'X',
      concepts: [],
      relations: [],
      meta: { display: {} },
    })
    expect(Object.keys(JSON.parse(partial))).toEqual([
      'version',
      'vocabulary',
      'name',
      'concepts',
      'relations',
      'meta',
    ])

    // Full: every optional envelope key present
    const full = serialize({
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      id: 'doc-1',
      updatedAt: 1711234567890,
      name: 'X',
      concepts: [],
      relations: [],
      meta: { display: {} },
    })
    expect(Object.keys(JSON.parse(full))).toEqual([
      'version',
      'vocabulary',
      'id',
      'updatedAt',
      'name',
      'concepts',
      'relations',
      'meta',
    ])
  })

  it('omits every absent optional envelope key from serialized JSON', () => {
    const json = serialize({ name: 'X', concepts: [], relations: [] })
    const parsed = JSON.parse(json)
    expect(parsed).not.toHaveProperty('vocabulary')
    expect(parsed).not.toHaveProperty('id')
    expect(parsed).not.toHaveProperty('updatedAt')
    expect(parsed).not.toHaveProperty('meta')
  })

  it('preserves id in serialized JSON and round-trips it through deserialize', () => {
    const doc: GraphDocumentInput = {
      id: 'sync-42',
      name: 'X',
      concepts: [makeConcept('n1')],
      relations: [],
    }
    const json = serialize(doc)
    const parsed = JSON.parse(json)
    expect(parsed.id).toBe('sync-42')

    const deserialized = deserialize(json)
    expect(deserialized.id).toBe('sync-42')
  })

  it('preserves updatedAt in serialized JSON and round-trips it through deserialize', () => {
    const doc: GraphDocumentInput = {
      updatedAt: 1711234567890,
      name: 'X',
      concepts: [makeConcept('n1')],
      relations: [],
    }
    const json = serialize(doc)
    const parsed = JSON.parse(json)
    expect(parsed.updatedAt).toBe(1711234567890)

    const deserialized = deserialize(json)
    expect(deserialized.updatedAt).toBe(1711234567890)
  })

  it('leaves optional envelope keys absent in the deserialized document when the source omits them', () => {
    const json = JSON.stringify({ name: 'Minimal', concepts: [], relations: [] })
    const doc = deserialize(json)
    expect(doc).not.toHaveProperty('vocabulary')
    expect(doc).not.toHaveProperty('id')
    expect(doc).not.toHaveProperty('updatedAt')
    expect(doc).not.toHaveProperty('meta')
  })

  it('omits a non-string id from the deserialized document', () => {
    const json = JSON.stringify({
      id: 999,
      name: 'X',
      concepts: [],
      relations: [],
    })
    const doc = deserialize(json)
    expect(doc).not.toHaveProperty('id')
  })

  it('omits a non-number updatedAt from the deserialized document', () => {
    const json = JSON.stringify({
      updatedAt: 'yesterday',
      name: 'X',
      concepts: [],
      relations: [],
    })
    const doc = deserialize(json)
    expect(doc).not.toHaveProperty('updatedAt')
  })

  it('preserves record meta and omits non-record or absent meta', () => {
    const base = { concepts: [], relations: [] }

    // Absent meta → omitted
    const jsonAbsent = JSON.stringify(base)
    expect(deserialize(jsonAbsent)).not.toHaveProperty('meta')

    // null meta → omitted (null is not a record)
    const jsonNull = JSON.stringify({ ...base, meta: null })
    expect(deserialize(jsonNull)).not.toHaveProperty('meta')

    // false meta → omitted (boolean is not a record)
    const jsonFalse = JSON.stringify({ ...base, meta: false })
    expect(deserialize(jsonFalse)).not.toHaveProperty('meta')

    // 0 meta → omitted (number is not a record)
    const jsonZero = JSON.stringify({ ...base, meta: 0 })
    expect(deserialize(jsonZero)).not.toHaveProperty('meta')

    // record meta → preserved
    const jsonRecord = JSON.stringify({ ...base, meta: { display: {} } })
    expect(deserialize(jsonRecord)).toMatchObject({ meta: { display: {} } })

    // empty record meta → preserved
    const jsonEmpty = JSON.stringify({ ...base, name: 'X', meta: {} })
    expect(deserialize(jsonEmpty)).toMatchObject({ name: 'X', meta: {} })
  })

  it('defaults missing name to an empty string', () => {
    const json = JSON.stringify({ concepts: [], relations: [] })
    const doc = deserialize(json)
    expect(doc.name).toBe('')
  })

  it('defaults non-string name to an empty string', () => {
    const cases: { desc: string; name: unknown }[] = [
      { desc: 'name is a number', name: 42 },
      { desc: 'name is null', name: null },
      { desc: 'name is a boolean', name: true },
      { desc: 'name is an object', name: {} },
    ]
    for (const { desc, name } of cases) {
      const json = JSON.stringify({ name, concepts: [], relations: [] })
      expect(deserialize(json).name, desc).toBe('')
    }
  })

  it('preserves valid vocabulary with string id and version', () => {
    const json = JSON.stringify({
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      concepts: [],
      relations: [],
    })
    const doc = deserialize(json)
    expect(doc.vocabulary).toEqual({ id: '@nesso-how/vocab-learning', version: '0.1.0' })
  })

  it('omits vocabulary when it is not a record with string id and version', () => {
    const base = { concepts: [], relations: [] }
    const cases: { desc: string; vocabulary: unknown }[] = [
      { desc: 'vocabulary is a number', vocabulary: 42 },
      { desc: 'vocabulary is null', vocabulary: null },
      { desc: 'vocabulary is a string', vocabulary: 'vocab' },
      { desc: 'vocabulary is an array', vocabulary: [] },
      { desc: 'vocabulary is missing id', vocabulary: { version: '1.0' } },
      { desc: 'vocabulary is missing version', vocabulary: { id: 'vocab' } },
      { desc: 'vocabulary has non-string id', vocabulary: { id: 42, version: '1.0' } },
      { desc: 'vocabulary has non-string version', vocabulary: { id: 'vocab', version: 42 } },
    ]
    for (const { desc, vocabulary } of cases) {
      const json = JSON.stringify({ ...base, vocabulary })
      const doc = deserialize(json)
      expect(doc, desc).not.toHaveProperty('vocabulary')
    }
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

  it('rejects individual invalid concept field values', () => {
    const base = { concepts: [] as unknown[], relations: [] }
    const cases: { desc: string; concept: unknown }[] = [
      // id
      { desc: 'non-string id (number)', concept: { id: 42, label: 'x', x: 0, y: 0 } },
      { desc: 'empty id', concept: { id: '', label: 'x', x: 0, y: 0 } },
      // label
      { desc: 'non-string label (number)', concept: { id: 'n1', label: 42, x: 0, y: 0 } },
      { desc: 'missing label', concept: { id: 'n1', x: 0, y: 0 } },
      // x
      { desc: 'non-number x (string)', concept: { id: 'n1', label: 'x', x: 'bad', y: 0 } },
      { desc: 'missing x', concept: { id: 'n1', label: 'x', y: 0 } },
      // y
      { desc: 'non-number y (string)', concept: { id: 'n1', label: 'x', x: 0, y: 'bad' } },
      { desc: 'missing y', concept: { id: 'n1', label: 'x', x: 0 } },
    ]
    for (const { desc, concept } of cases) {
      const json = JSON.stringify({ ...base, concepts: [concept] })
      expect(() => deserialize(json), desc).toThrow(
        /concept 0 is missing a valid id, label, or position/,
      )
    }
  })

  it('rejects a concept with a non-finite position (Infinity)', () => {
    // JSON.stringify converts Infinity to null, so construct the JSON manually
    // with 1e400, which JSON.parse produces as Infinity.
    const jsonX = JSON.stringify({
      concepts: [{ id: 'n1', label: 'x', y: 0 }],
      relations: [],
    }).replace('"y":0}', '"x":1e400,"y":0}')
    expect(() => deserialize(jsonX)).toThrow(/concept 0 is missing a valid id, label, or position/)

    const jsonY = JSON.stringify({
      concepts: [{ id: 'n1', label: 'x', x: 0 }],
      relations: [],
    }).replace('"x":0}', '"x":0,"y":1e400}')
    expect(() => deserialize(jsonY)).toThrow(/concept 0 is missing a valid id, label, or position/)
  })

  it('rejects a concept with a null position (from serialized NaN)', () => {
    // NaN serializes to null in JSON; null is not finite.
    const concept = { id: 'n1', label: 'x', x: 0, y: Number.NaN }
    const json = JSON.stringify({ concepts: [concept], relations: [] })
    expect(() => deserialize(json)).toThrow(/concept 0 is missing a valid id, label, or position/)
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

  it('preserves valid string relation type', () => {
    const json = JSON.stringify({
      concepts: [{ id: 'n1', label: 'n1', x: 0, y: 0 }],
      relations: [{ id: 'e1', source: 'n1', target: 'n1', type: 'causes' }],
    })
    const doc = deserialize(json)
    expect(doc.relations[0]).toMatchObject({ type: 'causes' })
  })

  it('preserves relation data alongside a valid type', () => {
    const json = JSON.stringify({
      concepts: [{ id: 'n1', label: 'n1', x: 0, y: 0 }],
      relations: [{ id: 'e1', source: 'n1', target: 'n1', type: 'causes', data: { weight: 0.5 } }],
    })
    const doc = deserialize(json)
    expect(doc.relations[0]).toMatchObject({ type: 'causes', data: { weight: 0.5 } })
  })

  it('omits non-string relation type from the deserialized relation', () => {
    const base = { concepts: [{ id: 'n1', label: 'n1', x: 0, y: 0 }] }
    const cases: { desc: string; type: unknown }[] = [
      { desc: 'type is a number', type: 42 },
      { desc: 'type is null', type: null },
      { desc: 'type is a boolean', type: true },
      { desc: 'type is an object', type: {} },
    ]
    for (const { desc, type } of cases) {
      const relation = { id: 'e1', source: 'n1', target: 'n1', type }
      const json = JSON.stringify({ ...base, relations: [relation] })
      const doc = deserialize(json)
      expect(doc.relations[0], desc).not.toHaveProperty('type')
    }
  })

  it('omits array meta from the deserialized document', () => {
    const json = JSON.stringify({
      concepts: [{ id: 'n1', label: 'n1', x: 0, y: 0 }],
      relations: [],
      meta: [],
    })
    const doc = deserialize(json)
    expect(doc).not.toHaveProperty('meta')
  })

  it('omits absent optional relation properties with exact shapes', () => {
    const json = JSON.stringify({
      concepts: [{ id: 'n1', label: 'n1', x: 0, y: 0 }],
      relations: [{ id: 'e1', source: 'n1', target: 'n1' }],
    })
    const doc = deserialize(json)
    expect(doc.relations[0]).toEqual({ id: 'e1', source: 'n1', target: 'n1' })
  })
})
