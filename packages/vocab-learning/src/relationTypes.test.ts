// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { RELATION_TYPES } from './relationTypes.js'

describe('RELATION_TYPES visual encoding', () => {
  it('uses glyphs without a per-type line style', () => {
    expect(Object.keys(RELATION_TYPES)).toHaveLength(52)

    for (const definition of Object.values(RELATION_TYPES)) {
      expect(definition.glyph).toBeDefined()
      expect(definition).not.toHaveProperty('line')
    }
  })
})
