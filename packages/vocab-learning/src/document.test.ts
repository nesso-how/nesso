// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { deserialize, serialize } from './document.js'

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
      name: 'X',
      concepts: [{ id: 'n1', label: 'n1', x: 0, y: 0 }],
      relations: [{ id: 'e1', source: 'n1', target: 'n1', type: 'not-a-real-type' }],
    })
    expect(() => deserialize(json)).toThrow(/unknown relation type/)
  })

  it('rejects an elaboration with a missing definition field', () => {
    const json = JSON.stringify({
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
    expect(() => deserialize(json)).toThrow(/elaboration.definition must be a string/)
  })
})
