// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import envelopeV1 from './fixtures/envelope/v1.json'
import {
  deserialize,
  GRAPH_FORMAT_VERSION,
  NewerGraphFormatError,
  serialize,
  UnsupportedGraphFormatError,
  type GraphDocumentInput,
} from './index.js'

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
    const json = JSON.stringify({
      version: GRAPH_FORMAT_VERSION,
      name: 'Minimal',
      concepts: [],
      relations: [],
    })
    const doc = deserialize(json)
    expect(doc).not.toHaveProperty('vocabulary')
    expect(doc).not.toHaveProperty('id')
    expect(doc).not.toHaveProperty('updatedAt')
    expect(doc).not.toHaveProperty('meta')
  })

  it('omits a non-string id from the deserialized document', () => {
    const json = JSON.stringify({
      version: GRAPH_FORMAT_VERSION,
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
      version: GRAPH_FORMAT_VERSION,
      updatedAt: 'yesterday',
      name: 'X',
      concepts: [],
      relations: [],
    })
    const doc = deserialize(json)
    expect(doc).not.toHaveProperty('updatedAt')
  })

  it('preserves record meta and omits non-record or absent meta', () => {
    const base = { version: GRAPH_FORMAT_VERSION, concepts: [], relations: [] }

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
    const json = JSON.stringify({ version: GRAPH_FORMAT_VERSION, concepts: [], relations: [] })
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
      const json = JSON.stringify({
        version: GRAPH_FORMAT_VERSION,
        name,
        concepts: [],
        relations: [],
      })
      expect(deserialize(json).name, desc).toBe('')
    }
  })

  it('preserves valid vocabulary with string id and version', () => {
    const json = JSON.stringify({
      version: GRAPH_FORMAT_VERSION,
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      concepts: [],
      relations: [],
    })
    const doc = deserialize(json)
    expect(doc.vocabulary).toEqual({ id: '@nesso-how/vocab-learning', version: '0.1.0' })
  })

  it('omits vocabulary when it is not a record with string id and version', () => {
    const base = { version: GRAPH_FORMAT_VERSION, concepts: [], relations: [] }
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
    expect(() => deserialize(JSON.stringify({ version: GRAPH_FORMAT_VERSION }))).toThrow(
      /missing concepts or relations/,
    )
    expect(() =>
      deserialize(JSON.stringify({ version: GRAPH_FORMAT_VERSION, concepts: [] })),
    ).toThrow(/missing concepts or relations/)
  })

  it('rejects a non-object root', () => {
    expect(() => deserialize('null')).toThrow(/Invalid Nesso graph document/)
    expect(() => deserialize('42')).toThrow(/Invalid Nesso graph document/)
  })

  it('rejects a concept entry that is not an object', () => {
    const json = JSON.stringify({
      version: GRAPH_FORMAT_VERSION,
      concepts: ['oops'],
      relations: [],
    })
    expect(() => deserialize(json)).toThrow(/concept 0 is missing a valid id, label, or position/)
  })

  it('rejects individual invalid concept field values', () => {
    const base = { version: GRAPH_FORMAT_VERSION, concepts: [] as unknown[], relations: [] }
    const cases: { desc: string; concept: unknown }[] = [
      { desc: 'non-string id (number)', concept: { id: 42, label: 'x', x: 0, y: 0 } },
      { desc: 'empty id', concept: { id: '', label: 'x', x: 0, y: 0 } },
      { desc: 'non-string label (number)', concept: { id: 'n1', label: 42, x: 0, y: 0 } },
      { desc: 'missing label', concept: { id: 'n1', x: 0, y: 0 } },
      { desc: 'non-number x (string)', concept: { id: 'n1', label: 'x', x: 'bad', y: 0 } },
      { desc: 'missing x', concept: { id: 'n1', label: 'x', y: 0 } },
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

  it('rejects non-finite and null concept positions', () => {
    const jsonX = JSON.stringify({
      version: GRAPH_FORMAT_VERSION,
      concepts: [{ id: 'n1', label: 'x', y: 0 }],
      relations: [],
    }).replace('"y":0}', '"x":1e400,"y":0}')
    expect(() => deserialize(jsonX)).toThrow(/concept 0 is missing a valid id, label, or position/)

    const jsonY = JSON.stringify({
      version: GRAPH_FORMAT_VERSION,
      concepts: [{ id: 'n1', label: 'x', x: 0 }],
      relations: [],
    }).replace('"x":0}', '"x":0,"y":1e400}')
    expect(() => deserialize(jsonY)).toThrow(/concept 0 is missing a valid id, label, or position/)

    const concept = { id: 'n1', label: 'x', x: 0, y: Number.NaN }
    expect(() =>
      deserialize(
        JSON.stringify({ version: GRAPH_FORMAT_VERSION, concepts: [concept], relations: [] }),
      ),
    ).toThrow(/concept 0 is missing a valid id, label, or position/)
  })

  it('rejects a concept with a null position (from serialized NaN)', () => {
    // NaN serializes to null in JSON; null is not finite.
    const concept = { id: 'n1', label: 'x', x: 0, y: Number.NaN }
    const json = JSON.stringify({
      version: GRAPH_FORMAT_VERSION,
      concepts: [concept],
      relations: [],
    })
    expect(() => deserialize(json)).toThrow(/concept 0 is missing a valid id, label, or position/)
  })

  it('rejects a relation that is not an object or is missing id, source or target', () => {
    const base = {
      version: GRAPH_FORMAT_VERSION,
      concepts: [{ id: 'n1', label: 'n1', x: 0, y: 0 }],
    }
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
      version: GRAPH_FORMAT_VERSION,
      concepts: [{ id: 'n1', label: 'n1', x: 0, y: 0 }],
      relations: [{ id: 'e1', source: 'n1', target: 'n1', type: 'causes' }],
    })
    const doc = deserialize(json)
    expect(doc.relations[0]).toMatchObject({ type: 'causes' })
  })

  it('preserves relation data alongside a valid type', () => {
    const json = JSON.stringify({
      version: GRAPH_FORMAT_VERSION,
      concepts: [{ id: 'n1', label: 'n1', x: 0, y: 0 }],
      relations: [{ id: 'e1', source: 'n1', target: 'n1', type: 'causes', data: { weight: 0.5 } }],
    })
    const doc = deserialize(json)
    expect(doc.relations[0]).toMatchObject({ type: 'causes', data: { weight: 0.5 } })
  })

  it('omits non-string relation type from the deserialized relation', () => {
    const base = {
      version: GRAPH_FORMAT_VERSION,
      concepts: [{ id: 'n1', label: 'n1', x: 0, y: 0 }],
    }
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
      version: GRAPH_FORMAT_VERSION,
      concepts: [{ id: 'n1', label: 'n1', x: 0, y: 0 }],
      relations: [],
      meta: [],
    })
    const doc = deserialize(json)
    expect(doc).not.toHaveProperty('meta')
  })

  it('omits absent optional relation properties with exact shapes', () => {
    const json = JSON.stringify({
      version: GRAPH_FORMAT_VERSION,
      concepts: [{ id: 'n1', label: 'n1', x: 0, y: 0 }],
      relations: [{ id: 'e1', source: 'n1', target: 'n1' }],
    })
    const doc = deserialize(json)
    expect(doc.relations[0]).toEqual({ id: 'e1', source: 'n1', target: 'n1' })
  })
})

describe('envelope compatibility', () => {
  it('replays the released envelope-v1 fixture', () => {
    const document = deserialize(JSON.stringify(envelopeV1))

    expect(document.version).toBe(GRAPH_FORMAT_VERSION)
    expect(document.id).toBe('fixture-envelope-v1')
    expect(document.name).toBe('Envelope v1')
    expect(document.concepts[0]?.label).toBe('Compatibility')
  })

  it('rejects an unversioned pre-baseline document', () => {
    const json = JSON.stringify({
      name: 'Unsupported alpha document',
      concepts: [],
      relations: [],
    })

    expect(() => deserialize(json)).toThrowError(new UnsupportedGraphFormatError(undefined))
  })

  it('rejects a malformed envelope version', () => {
    const json = JSON.stringify({
      version: '1',
      name: 'Malformed',
      concepts: [],
      relations: [],
    })

    expect(() => deserialize(json)).toThrowError(new UnsupportedGraphFormatError(undefined))
  })

  it('uses a distinct forward guard for a newer envelope', () => {
    const json = JSON.stringify({
      version: GRAPH_FORMAT_VERSION + 1,
      name: 'From the future',
      concepts: [],
      relations: [],
    })

    expect(() => deserialize(json)).toThrowError(
      new NewerGraphFormatError(GRAPH_FORMAT_VERSION + 1),
    )
  })

  it('rejects an older envelope when no sequential step exists', () => {
    const json = JSON.stringify({
      version: 0,
      name: 'Unsupported alpha document',
      concepts: [],
      relations: [],
    })

    expect(() => deserialize(json)).toThrowError(new UnsupportedGraphFormatError(0))
  })

  describe('error details', () => {
    function throwUnversioned() {
      deserialize(JSON.stringify({ name: 'X', concepts: [], relations: [] }))
    }

    function throwStringVersion() {
      deserialize(JSON.stringify({ version: '1', name: 'X', concepts: [], relations: [] }))
    }

    function throwOldVersion() {
      deserialize(JSON.stringify({ version: 0, name: 'X', concepts: [], relations: [] }))
    }

    function throwNewerVersion() {
      deserialize(
        JSON.stringify({
          version: GRAPH_FORMAT_VERSION + 1,
          name: 'X',
          concepts: [],
          relations: [],
        }),
      )
    }

    function throwFloatVersion() {
      deserialize(JSON.stringify({ version: 1.5, name: 'X', concepts: [], relations: [] }))
    }

    function throwNegativeVersion() {
      deserialize(JSON.stringify({ version: -1, name: 'X', concepts: [], relations: [] }))
    }

    it('has the correct message, name, and version for an unversioned document', () => {
      try {
        throwUnversioned()
        expect.unreachable()
      } catch (err) {
        expect(err).toBeInstanceOf(UnsupportedGraphFormatError)
        expect((err as UnsupportedGraphFormatError).name).toBe('UnsupportedGraphFormatError')
        expect((err as UnsupportedGraphFormatError).message).toBe(
          'This graph does not declare a supported Nesso graph format version',
        )
        expect((err as UnsupportedGraphFormatError).version).toBeUndefined()
      }
    })

    it('has the correct message, name, and version for a string version', () => {
      try {
        throwStringVersion()
        expect.unreachable()
      } catch (err) {
        expect(err).toBeInstanceOf(UnsupportedGraphFormatError)
        expect((err as UnsupportedGraphFormatError).name).toBe('UnsupportedGraphFormatError')
        expect((err as UnsupportedGraphFormatError).message).toBe(
          'This graph does not declare a supported Nesso graph format version',
        )
        expect((err as UnsupportedGraphFormatError).version).toBeUndefined()
      }
    })

    it('has the correct message, name, and version for an older version', () => {
      try {
        throwOldVersion()
        expect.unreachable()
      } catch (err) {
        expect(err).toBeInstanceOf(UnsupportedGraphFormatError)
        expect((err as UnsupportedGraphFormatError).name).toBe('UnsupportedGraphFormatError')
        expect((err as UnsupportedGraphFormatError).message).toBe(
          'Unsupported Nesso graph format version: 0',
        )
        expect((err as UnsupportedGraphFormatError).version).toBe(0)
      }
    })

    it('has the correct message, name, and version for a newer version', () => {
      try {
        throwNewerVersion()
        expect.unreachable()
      } catch (err) {
        expect(err).toBeInstanceOf(NewerGraphFormatError)
        expect((err as NewerGraphFormatError).name).toBe('NewerGraphFormatError')
        expect((err as NewerGraphFormatError).message).toBe(
          'This graph uses newer Nesso graph format version 2',
        )
        expect((err as NewerGraphFormatError).version).toBe(2)
      }
    })

    it('rejects a float version as malformed', () => {
      try {
        throwFloatVersion()
        expect.unreachable()
      } catch (err) {
        expect(err).toBeInstanceOf(UnsupportedGraphFormatError)
        expect((err as UnsupportedGraphFormatError).message).toBe(
          'This graph does not declare a supported Nesso graph format version',
        )
        expect((err as UnsupportedGraphFormatError).version).toBeUndefined()
      }
    })

    it('rejects a negative version as malformed', () => {
      try {
        throwNegativeVersion()
        expect.unreachable()
      } catch (err) {
        expect(err).toBeInstanceOf(UnsupportedGraphFormatError)
        expect((err as UnsupportedGraphFormatError).message).toBe(
          'This graph does not declare a supported Nesso graph format version',
        )
        expect((err as UnsupportedGraphFormatError).version).toBeUndefined()
      }
    })
  })
})

describe('serialize field omission', () => {
  const base: GraphDocumentInput = { name: 'X', concepts: [], relations: [] }

  it('omits vocabulary when absent', () => {
    expect(serialize(base)).not.toContain('vocabulary')
  })

  it('omits id when absent', () => {
    expect(serialize(base)).not.toContain('"id"')
  })

  it('omits updatedAt when absent', () => {
    expect(serialize(base)).not.toContain('updatedAt')
  })

  it('omits meta when absent', () => {
    expect(serialize(base)).not.toContain('meta')
  })
})

describe('deserialize type narrowing', () => {
  function validBase() {
    return { version: GRAPH_FORMAT_VERSION, concepts: [], relations: [] }
  }

  it('defaults name to empty string when not a string', () => {
    const doc = deserialize(JSON.stringify({ ...validBase() }))
    expect(doc.name).toBe('')
  })

  it('defaults name to empty string when name is a number', () => {
    const doc = deserialize(JSON.stringify({ ...validBase(), name: 42 }))
    expect(doc.name).toBe('')
  })

  it('defaults id to undefined when id is not a string', () => {
    const doc = deserialize(JSON.stringify({ ...validBase(), name: 'X', id: 99 }))
    expect(doc.id).toBeUndefined()
  })

  it('defaults updatedAt to undefined when updatedAt is not a number', () => {
    const doc = deserialize(JSON.stringify({ ...validBase(), name: 'X', updatedAt: 'now' }))
    expect(doc.updatedAt).toBeUndefined()
  })

  it('drops vocabulary when vocabulary is not an object', () => {
    const doc = deserialize(JSON.stringify({ ...validBase(), name: 'X', vocabulary: 123 }))
    expect(doc.vocabulary).toBeUndefined()
  })

  it('drops vocabulary when vocabulary.id is not a string', () => {
    const doc = deserialize(
      JSON.stringify({ ...validBase(), name: 'X', vocabulary: { id: 1, version: '0.1.0' } }),
    )
    expect(doc.vocabulary).toBeUndefined()
  })

  it('drops vocabulary when vocabulary.version is not a string', () => {
    const doc = deserialize(
      JSON.stringify({ ...validBase(), name: 'X', vocabulary: { id: 'x', version: 1 } }),
    )
    expect(doc.vocabulary).toBeUndefined()
  })

  it('drops relation type when it is not a string', () => {
    const doc = deserialize(
      JSON.stringify({
        ...validBase(),
        name: 'X',
        concepts: [{ id: 'n1', label: 'n1', x: 0, y: 0 }],
        relations: [{ id: 'e1', source: 'n1', target: 'n1', type: 42 }],
      }),
    )
    expect(doc.relations[0].type).toBeUndefined()
  })
})

describe('deserialize concept type narrowing', () => {
  function base() {
    return { version: GRAPH_FORMAT_VERSION, name: 'X', relations: [] }
  }

  it('rejects a concept with a numeric id', () => {
    const json = JSON.stringify({
      ...base(),
      concepts: [{ id: 1, label: 'x', x: 0, y: 0 }],
    })
    expect(() => deserialize(json)).toThrow(/concept 0 is missing/)
  })

  it('rejects a concept with a non-string label', () => {
    const json = JSON.stringify({
      ...base(),
      concepts: [{ id: 'n1', label: 99, x: 0, y: 0 }],
    })
    expect(() => deserialize(json)).toThrow(/concept 0 is missing/)
  })

  it('rejects a concept with a string x coordinate', () => {
    const json = JSON.stringify({
      ...base(),
      concepts: [{ id: 'n1', label: 'n1', x: '0', y: 0 }],
    })
    expect(() => deserialize(json)).toThrow(/concept 0 is missing/)
  })

  it('rejects a concept with a string y coordinate', () => {
    const json = JSON.stringify({
      ...base(),
      concepts: [{ id: 'n1', label: 'n1', x: 0, y: '0' }],
    })
    expect(() => deserialize(json)).toThrow(/concept 0 is missing/)
  })

  it('rejects a concept with an infinite x coordinate', () => {
    const json = JSON.stringify({
      ...base(),
      concepts: [{ id: 'n1', label: 'n1', x: Number.POSITIVE_INFINITY, y: 0 }],
    })
    expect(() => deserialize(json)).toThrow(/concept 0 is missing/)
  })
})

describe('deserialize meta handling', () => {
  function base() {
    return { version: GRAPH_FORMAT_VERSION, name: 'X', concepts: [], relations: [] }
  }

  it('sets meta from the source document', () => {
    const doc = deserialize(JSON.stringify({ ...base(), meta: { display: {} } }))
    expect(doc.meta).toEqual({ display: {} })
  })

  it('omits meta when not present', () => {
    const doc = deserialize(JSON.stringify(base()))
    expect(doc.meta).toBeUndefined()
    expect('meta' in doc).toBe(false)
  })

  it('omits meta when explicitly null', () => {
    const doc = deserialize(JSON.stringify({ ...base(), meta: null }))
    expect(doc.meta).toBeUndefined()
  })
})

describe('deserialize return field presence', () => {
  it('omits vocabulary key when vocabulary is absent', () => {
    const doc = deserialize(
      JSON.stringify({ version: GRAPH_FORMAT_VERSION, name: 'X', concepts: [], relations: [] }),
    )
    expect('vocabulary' in doc).toBe(false)
  })

  it('omits id key when id is absent', () => {
    const doc = deserialize(
      JSON.stringify({ version: GRAPH_FORMAT_VERSION, name: 'X', concepts: [], relations: [] }),
    )
    expect('id' in doc).toBe(false)
  })

  it('omits updatedAt key when updatedAt is absent', () => {
    const doc = deserialize(
      JSON.stringify({ version: GRAPH_FORMAT_VERSION, name: 'X', concepts: [], relations: [] }),
    )
    expect('updatedAt' in doc).toBe(false)
  })

  it('includes vocabulary key when vocabulary is present', () => {
    const doc = deserialize(
      JSON.stringify({
        version: GRAPH_FORMAT_VERSION,
        name: 'X',
        concepts: [],
        relations: [],
        vocabulary: { id: 'test', version: '1.0' },
      }),
    )
    expect(doc.vocabulary).toEqual({ id: 'test', version: '1.0' })
  })

  it('includes id key when id is present', () => {
    const doc = deserialize(
      JSON.stringify({
        version: GRAPH_FORMAT_VERSION,
        name: 'X',
        concepts: [],
        relations: [],
        id: 'my-id',
      }),
    )
    expect(doc.id).toBe('my-id')
  })

  it('includes updatedAt key when updatedAt is present', () => {
    const doc = deserialize(
      JSON.stringify({
        version: GRAPH_FORMAT_VERSION,
        name: 'X',
        concepts: [],
        relations: [],
        updatedAt: 1700000000000,
      }),
    )
    expect(doc.updatedAt).toBe(1700000000000)
  })

  it('omits meta key when meta is absent', () => {
    const doc = deserialize(
      JSON.stringify({ version: GRAPH_FORMAT_VERSION, name: 'X', concepts: [], relations: [] }),
    )
    expect('meta' in doc).toBe(false)
  })
})
