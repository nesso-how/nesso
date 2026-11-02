import assert from 'node:assert/strict'
import test from 'node:test'
import { hasAiEffects, summarizeAiEffects } from './effects.ts'
import type { AiEffects } from './results.ts'

const counts = { added: 0, updated: 0, removed: 0 }
const empty: AiEffects = {
  concepts: counts,
  relations: counts,
  relationTypes: counts,
  views: counts,
  memberships: 0,
}

test('effect summaries aggregate every group and preserve membership counts', () => {
  const effects: AiEffects = {
    concepts: { added: 1, updated: 2, removed: 3 },
    relations: { added: 4, updated: 5, removed: 6 },
    relationTypes: { added: 7, updated: 8, removed: 9 },
    views: { added: 10, updated: 11, removed: 12 },
    memberships: 13,
  }
  assert.deepEqual(summarizeAiEffects(effects), {
    added: 22,
    updated: 26,
    removed: 30,
    memberships: 13,
  })
})

test('effect detection includes each group and membership-only changes', () => {
  assert.equal(hasAiEffects(empty), false)
  for (const group of ['concepts', 'relations', 'relationTypes', 'views'] as const) {
    for (const change of ['added', 'updated', 'removed'] as const) {
      assert.equal(hasAiEffects({ ...empty, [group]: { ...counts, [change]: 1 } }), true)
    }
  }
  assert.equal(hasAiEffects({ ...empty, memberships: 1 }), true)
})
