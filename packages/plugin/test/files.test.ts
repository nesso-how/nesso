import assert from 'node:assert/strict'
import test from 'node:test'
import { parseFileOptions, fileTextLimit, parsePluginMessage } from '../src/runtime.ts'

test('file arguments restrict paths, media types and picker filters', () => {
  const save = { name: 'nesso-view.jsonld', mediaType: 'application/ld+json', text: '{}' }
  assert.equal(parseFileOptions('save', save).name, save.name)
  for (const value of [
    { ...save, name: '../secret' },
    { ...save, name: 'bad\0name' },
    { ...save, path: '/private' },
    { ...save, mediaType: 'javascript:alert(1)' },
  ])
    assert.throws(() => parseFileOptions('save', value), { code: 'invalid-input' })
  assert.throws(() => parseFileOptions('open', { extensions: ['../json'], mimeTypes: [] }), {
    code: 'invalid-input',
  })
  assert.throws(
    () => parseFileOptions('open', { extensions: ['json'], mimeTypes: [], multiple: true }),
    { code: 'invalid-input' },
  )
})

test('image requests restrict format, scale and target selection', () => {
  const request = {
    type: 'request',
    id: 1,
    contextId: 'context',
    method: 'images.renderView',
    params: { format: 'png', scale: 4 },
  }
  assert.deepEqual(parsePluginMessage(request), request)
  for (const params of [
    { format: 'jpeg' },
    { format: 'png', scale: 100 },
    { format: 'png', viewId: 'other' },
  ])
    assert.throws(() => parsePluginMessage({ ...request, params }), { code: 'invalid-input' })
})

test('binary saves accept canonical base64 only and never mix encodings', () => {
  const binary = { name: 'view.png', mediaType: 'image/png', base64: 'AP/+' }
  assert.deepEqual(parseFileOptions('save', binary), binary)
  for (const base64 of [
    'AA',
    'AB==',
    'data:image/png;base64,AA==',
    Buffer.alloc(fileTextLimit + 1).toString('base64'),
  ])
    assert.throws(() => parseFileOptions('save', { ...binary, base64 }), { code: 'invalid-input' })
  assert.throws(() => parseFileOptions('save', { ...binary, text: '' }), { code: 'invalid-input' })
  assert.throws(() => parseFileOptions('save', { name: 'view.png', mediaType: 'image/png' }), {
    code: 'invalid-input',
  })
})
