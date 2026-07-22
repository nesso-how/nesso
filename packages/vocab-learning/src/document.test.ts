// SPDX-License-Identifier: MIT
import { GRAPH_FORMAT_VERSION } from '@nesso-how/schema'
import { describe, expect, it } from 'vitest'
import { deserialize, serialize } from './document.js'
import { VOCABULARY } from './index.js'

function documentWith(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: GRAPH_FORMAT_VERSION,
    vocabulary: {
      id: VOCABULARY.id,
      version: VOCABULARY.version,
    },
    name: 'Vocabulary fixture',
    concepts: [],
    relations: [],
    ...overrides,
  }
}

describe('vocab-learning serialize / deserialize', () => {
  it('round-trips a learning vocabulary graph document', () => {
    const doc = {
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      name: 'Demo',
      concepts: [
        {
          id: 'n1',
          label: 'Idea',
          x: 0,
          y: 0,
          data: { elaboration: { definition: 'd' } },
        },
      ],
      relations: [{ id: 'e1', source: 'n1', target: 'n1', type: 'causes' as const }],
    }
    const parsed = deserialize(serialize(doc))
    expect(parsed.concepts[0].label).toBe('Idea')
    expect(parsed.relations[0].type).toBe('causes')
    expect(parsed.concepts[0].data?.elaboration).toEqual({ definition: 'd' })
  })

  it('rejects an unknown relation type', () => {
    const json = JSON.stringify({
      version: GRAPH_FORMAT_VERSION,
      vocabulary: { id: VOCABULARY.id, version: VOCABULARY.version },
      name: 'X',
      concepts: [{ id: 'n1', label: 'n1', x: 0, y: 0 }],
      relations: [{ id: 'e1', source: 'n1', target: 'n1', type: 'not-a-real-type' }],
    })
    expect(() => deserialize(json)).toThrow(/unknown relation type/)
  })

  it('rejects an elaboration with a missing definition field', () => {
    const json = JSON.stringify({
      version: GRAPH_FORMAT_VERSION,
      vocabulary: { id: VOCABULARY.id, version: VOCABULARY.version },
      name: 'X',
      concepts: [
        {
          id: 'n1',
          label: 'n1',
          x: 0,
          y: 0,
          data: { elaboration: {} },
        },
      ],
      relations: [{ id: 'e1', source: 'n1', target: 'n1', type: 'causes' }],
    })
    expect(() => deserialize(json)).toThrow('Concept elaboration must contain only definition')
  })
})

describe('vocabulary compatibility boundary', () => {
  it('requires a vocabulary reference', () => {
    const input = documentWith()
    delete input.vocabulary

    expect(() => deserialize(JSON.stringify(input))).toThrow(
      'Graph document must declare a vocabulary',
    )
  })

  it('rejects a different vocabulary id', () => {
    const input = documentWith({
      vocabulary: {
        id: '@example/foreign-vocabulary',
        version: VOCABULARY.version,
      },
    })

    expect(() => deserialize(JSON.stringify(input))).toThrow(
      'Unsupported graph vocabulary: @example/foreign-vocabulary',
    )
  })

  it('rejects an unsupported vocabulary version', () => {
    const input = documentWith({
      vocabulary: {
        id: VOCABULARY.id,
        version: '99.0.0',
      },
    })

    expect(() => deserialize(JSON.stringify(input))).toThrow(
      'Unsupported learning vocabulary version: 99.0.0',
    )
  })

  it('serialize always injects vocabulary metadata so deserialize accepts it', () => {
    const json = serialize({
      name: 'No explicit vocabulary',
      concepts: [],
      relations: [],
    })
    const doc = deserialize(json)
    expect(doc.vocabulary).toEqual({
      id: '@nesso-how/vocab-learning',
      version: '0.1.0',
    })
  })

  it.each([
    'examples',
    'notes',
    'imageUrl',
    'imageTitle',
    'imageDescriptionUrl',
  ])('rejects removed alpha elaboration field %s', (field) => {
    const input = documentWith({
      concepts: [
        {
          id: 'concept-1',
          label: 'Concept',
          x: 0,
          y: 0,
          data: {
            elaboration: {
              definition: 'Supported definition',
              [field]: field === 'examples' ? ['unsupported'] : 'unsupported',
            },
          },
        },
      ],
    })

    expect(() => deserialize(JSON.stringify(input))).toThrow(
      'Concept elaboration must contain only definition',
    )
  })
})
