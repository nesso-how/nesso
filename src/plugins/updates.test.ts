import assert from 'node:assert/strict'
import test from 'node:test'
import { checkPluginUpdates } from './updates.ts'
import type { PluginEntry } from './registry.ts'
import type { NpmPlugin } from '../../shared/plugins.ts'

const i18n = {
  metadata: { name: { en: 'Test' }, description: { en: 'Test' }, documentation: { en: 'Test' } },
}
const installed: PluginEntry[] = [
  { id: 'actions', version: '1.0.0', kind: 'actions', contribution: [], i18n },
  { id: 'theme', version: '1.0.0', kind: 'theme', i18n },
  { id: 'vocab', version: '1.0.0', kind: 'vocab', i18n },
]
const latest = (entry: PluginEntry, version = '1.1.0'): NpmPlugin => ({
  name: entry.id,
  version,
  i18n,
  nesso:
    entry.kind === 'actions'
      ? { apiVersion: 1, kind: 'actions', entry: 'index.js', writes: [], capabilities: [] }
      : { apiVersion: 1, kind: entry.kind, entry: 'definition.json', writes: [], capabilities: [] },
})

test('manual checks share one metadata path for all kinds and never propose downgrades', async () => {
  const failed: string[] = []
  const updates = await checkPluginUpdates(
    { latest: async (name) => ({ value: latest(installed.find(({ id }) => id === name)!) }) },
    installed,
    (name) => failed.push(name),
  )
  assert.deepEqual(
    updates.map(({ name }) => name),
    ['actions', 'theme', 'vocab'],
  )
  assert.equal(failed.length, 0)
  assert.deepEqual(
    await checkPluginUpdates(
      {
        latest: async (name) => ({
          value: latest(
            installed.find(({ id }) => id === name)!,
            '0.9.0',
          ),
        }),
      },
      installed,
      (name) => failed.push(name),
    ),
    [],
  )
})

test('incompatible kinds, mismatched identities and network failures preserve packages and do not stop checking', async () => {
  const failed: string[] = []
  const updates = await checkPluginUpdates(
    {
      latest: async (name) => {
        if (name === 'actions') return { value: { ...latest(installed[1]), name } }
        if (name === 'theme') throw new Error('Network failure')
        return { value: { ...latest(installed[2]), name: 'other' } }
      },
    },
    installed,
    (name) => failed.push(name),
  )
  assert.deepEqual(updates, [])
  assert.deepEqual(failed, ['actions', 'theme', 'vocab'])
})
