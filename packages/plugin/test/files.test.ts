import assert from 'node:assert/strict'
import test from 'node:test'
import { parseFileOptions } from '../src/runtime.ts'

test('file arguments restrict paths, media types and picker filters', () => {
  const save = { name: 'nesso-view.jsonld', mediaType: 'application/ld+json', text: '{}' }
  assert.equal(parseFileOptions('save', save).name, save.name)
  for (const value of [{ ...save, name: '../secret' }, { ...save, name: 'bad\0name' }, { ...save, path: '/private' }, { ...save, mediaType: 'javascript:alert(1)' }]) assert.throws(() => parseFileOptions('save', value), { code: 'invalid-input' })
  assert.throws(() => parseFileOptions('open', { extensions: ['../json'], mimeTypes: [] }), { code: 'invalid-input' })
  assert.throws(() => parseFileOptions('open', { extensions: ['json'], mimeTypes: [], multiple: true }), { code: 'invalid-input' })
})
