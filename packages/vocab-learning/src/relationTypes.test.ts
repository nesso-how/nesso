// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import {
  RELATION_TYPES,
  RELATION_TYPE_VALUES,
  isPrimaryRelationType,
  type Cardinality,
} from './relationTypes.js'

describe('RELATION_TYPES visual encoding', () => {
  it('uses glyphs without a per-type line style', () => {
    expect(Object.keys(RELATION_TYPES)).toHaveLength(52)

    for (const definition of Object.values(RELATION_TYPES)) {
      expect(definition.glyph).toBeDefined()
      expect(definition).not.toHaveProperty('line')
    }
  })

  it('derives inverses from primaries with a stable value order', () => {
    expect(RELATION_TYPE_VALUES).toEqual([
      'subtype-of',
      'has-subtype',
      'instance-of',
      'has-instance',
      'part-of',
      'contains',
      'made-of',
      'composes',
      'causes',
      'caused-by',
      'produces',
      'produced-by',
      'enables',
      'enabled-by',
      'prevents',
      'prevented-by',
      'triggers',
      'triggered-by',
      'inhibits',
      'inhibited-by',
      'disables',
      'disabled-by',
      'consumes',
      'consumed-by',
      'delays',
      'delayed-by',
      'requires',
      'required-by',
      'uses',
      'used-by',
      'used-for',
      'purpose-of',
      'precedes',
      'follows',
      'occurs-in',
      'has-occurrence',
      'during',
      'spans',
      'overlaps-with',
      'derives-from',
      'gives-rise-to',
      'contrasts-with',
      'opposite-of',
      'similar-to',
      'analogous-to',
      'supports',
      'supported-by',
      'contradicts',
      'explains',
      'explained-by',
      'defines',
      'defined-by',
    ])

    const flip = (cardinality: Cardinality): Cardinality => {
      if (cardinality === 'N-1') return '1-N'
      if (cardinality === '1-N') return 'N-1'
      return cardinality
    }

    for (const id of RELATION_TYPE_VALUES) {
      const definition = RELATION_TYPES[id]
      if (definition.inverse === 'self') {
        expect(isPrimaryRelationType(id)).toBe(true)
        continue
      }
      const peer = RELATION_TYPES[definition.inverse]
      expect(peer.inverse).toBe(id)
      expect(peer.cat).toBe(definition.cat)
      expect(peer.transitive).toBe(definition.transitive)
      expect(peer.strength).toBe(definition.strength)
      expect(peer.polarity).toBe(definition.polarity)
      expect(peer.cardinality).toBe(flip(definition.cardinality))
      if (id === 'part-of' || id === 'contains') {
        expect(RELATION_TYPES['part-of'].glyph).toBe('diamond')
        expect(RELATION_TYPES.contains.glyph).toBe('diamond-open')
      } else {
        expect(peer.glyph).toBe(definition.glyph)
      }
      expect(isPrimaryRelationType(id)).toBe(
        RELATION_TYPE_VALUES.indexOf(id) < RELATION_TYPE_VALUES.indexOf(definition.inverse),
      )
    }
  })
})
