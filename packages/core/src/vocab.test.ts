import assert from 'node:assert/strict'
import test from 'node:test'
import type { VocabDefinition } from './types.ts'
import { resolveRelationTypeLabel } from './vocab.ts'

const type = { id: 'urn:part', label: 'partOf' }
const vocab: VocabDefinition = {
  id: 'example',
  relationTypes: [{ ...type, translations: { en: 'is part of', it: 'è parte di' } }],
  defaultTypeId: type.id,
}

test('vocabulary labels resolve by locale with English and canonical label fallback', () => {
  assert.equal(resolveRelationTypeLabel(type, [vocab], 'it'), 'è parte di')
  assert.equal(resolveRelationTypeLabel(type, [vocab], 'zh-CN'), 'is part of')
  const untranslated = { ...vocab, relationTypes: [type] }
  assert.equal(resolveRelationTypeLabel(type, [untranslated], 'it'), 'partOf')
})

test('custom labels and unavailable vocabularies remain unchanged', () => {
  assert.equal(
    resolveRelationTypeLabel({ id: 'urn:custom', label: 'parte di' }, [vocab], 'it'),
    'parte di',
  )
  assert.equal(
    resolveRelationTypeLabel({ ...type, label: 'mia relazione' }, [vocab], 'it'),
    'mia relazione',
  )
  assert.equal(resolveRelationTypeLabel(type, [], 'it'), 'partOf')
})
