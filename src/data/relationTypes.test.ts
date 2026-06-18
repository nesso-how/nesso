// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { RELATION_TYPES, RELATION_CATEGORIES, buildRelationGroups } from './relationTypes'

describe('buildRelationGroups', () => {
  it('keeps every relation type when the predicate always passes', () => {
    const groups = buildRelationGroups(() => true)
    const total = groups.reduce((acc, g) => acc + g.types.length, 0)
    expect(total).toBe(Object.keys(RELATION_TYPES).length)
    for (const g of groups) {
      expect(g.types.length).toBeGreaterThan(0)
      expect(g.color).toBe(RELATION_CATEGORIES[g.key].color)
    }
  })

  it('files every type under its own category', () => {
    for (const g of buildRelationGroups(() => true)) {
      for (const [, def] of g.types) {
        expect(def.cat).toBe(g.key)
      }
    }
  })

  it('drops categories whose types are all filtered out', () => {
    const groups = buildRelationGroups((id) => id === 'subtype-of')
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('taxonomic')
    expect(groups[0].types.map(([id]) => id)).toEqual(['subtype-of'])
  })

  it('returns an empty array when nothing matches', () => {
    expect(buildRelationGroups(() => false)).toEqual([])
  })

  it('passes the relation id and its definition to the predicate for every type', () => {
    const seen: string[] = []
    buildRelationGroups((id, def) => {
      expect(def.cat).toBeDefined()
      seen.push(id)
      return false
    })
    expect(seen).toContain('causes')
    expect(seen).toHaveLength(Object.keys(RELATION_TYPES).length)
  })
})
