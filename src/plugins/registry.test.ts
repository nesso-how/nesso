import assert from 'node:assert/strict'
import test from 'node:test'
import { createPluginRegistry, type PluginEntry } from './registry.ts'

test('external runtime availability is instance-local and publishes only changes', () => {
  const first = createPluginRegistry()
  const second = createPluginRegistry()
  const snapshot = first.getSnapshot()
  let calls = 0
  const stop = first.subscribe(() => calls++)
  assert.equal(first.getExternalAvailable(), false)
  first.setExternalAvailable(true)
  first.setExternalAvailable(true)
  assert.equal(first.getExternalAvailable(), true)
  assert.equal(second.getExternalAvailable(), false)
  assert.equal(first.getSnapshot(), snapshot)
  first.setExternalAvailable(false)
  assert.equal(calls, 2)
  stop()
})

test('registries own data-only snapshots, publish atomically, reject collisions and remain instance-local', () => {
  const first = createPluginRegistry()
  const second = createPluginRegistry()
  const entry: PluginEntry = {
    id: '@nesso/example',
    version: '1.0.0',
    kind: 'vocab',
    i18n: {
      metadata: {
        name: { en: 'Example' },
        description: { en: 'Example' },
        documentation: { en: 'Example' },
      },
    },
    contribution: {
      id: 'example',
      relationTypes: [{ id: 'urn:example:link', label: 'Link' }],
      defaultTypeId: 'urn:example:link',
    },
  }
  let calls = 0
  const stop = first.subscribe(() => calls++)
  first.replace([entry])
  assert.notEqual(first.getSnapshot()[0], entry)
  assert.deepEqual(second.getSnapshot(), [])
  const snapshot = first.getSnapshot()
  for (const entries of [
    [entry, entry],
    [entry, { ...entry, id: '@nesso/other' }],
  ]) {
    assert.throws(() => first.replace(entries), { code: 'denied' })
    assert.equal(first.getSnapshot(), snapshot)
  }
  stop()
  first.replace([])
  assert.equal(calls, 1)
})
