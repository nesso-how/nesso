// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { RELATION_CATEGORIES, RELATION_TYPES } from '@nesso-how/vocab-learning'
import { getRelationTypesPayload } from './get-relation-types.js'

describe('getRelationTypesPayload', () => {
  it('returns semantic properties without glyph or line styles for every relation type', () => {
    const payload = getRelationTypesPayload()
    const types = payload.flatMap((category) => category.types)

    expect(payload.map((category) => category.category)).toEqual([...RELATION_CATEGORIES])
    expect(types).toHaveLength(52)

    for (const type of types) {
      expect(type).not.toHaveProperty('glyph')
      expect(type).not.toHaveProperty('line')
      expect(type.symmetric).toBe(RELATION_TYPES[type.type].inverse === 'self')
    }
  })
})
