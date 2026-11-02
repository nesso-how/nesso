import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import {
  badgeLimits,
  type ActionBadgeInput,
  type ActionBadgeResult,
} from '@nesso-how/plugin/runtime'
import { createNessoStore } from '../store/create.ts'
import { createPluginRegistry, type PluginEntry } from './registry.ts'
import { createActionBadges } from './badges.ts'

function fixture(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  const host = createNessoStore({
    concepts: ['a', 'b'].map((id) => ({ id: `urn:${id}`, label: id, position: { x: 0, y: 0 } })),
    relations: [],
    relationTypes: [],
  })
  const first = host.store.createView('First', ['urn:a'])
  const second = host.store.createView('Second', ['urn:a', 'urn:b'])
  const plugin: PluginEntry = {
    id: 'nesso-plugin-badges',
    version: '1.0.0',
    kind: 'actions',
    access: { writes: [], capabilities: ['storage'] },
    i18n: {
      metadata: {
        name: { en: 'Badges' },
        description: { en: 'Badges' },
        documentation: { en: 'Badges' },
      },
    },
    contribution: [{ id: 'count', label: { en: 'Count' }, badge: true }],
  }
  const registry = createPluginRegistry()
  registry.replace([plugin])
  const calls: {
    input: ActionBadgeInput
    signal: AbortSignal
    resolve: (result: ActionBadgeResult) => void
  }[] = []
  const badges = createActionBadges(
    host.store,
    registry,
    async (_plugin, _actionId, input, signal) =>
      new Promise<ActionBadgeResult>((resolve) => calls.push({ input, signal, resolve })),
  )
  t.after(() => badges.dispose())
  return { host, first, second, plugin, calls, badges }
}

const settle = async () => {
  for (let index = 0; index < 5; index++) await Promise.resolve()
}

test('consumers share queries; storage changes invalidate overlapping views and discard stale results', async (t) => {
  const f = fixture(t)
  f.badges.watch('count', f.first, () => {})
  f.badges.watch('count', f.first, () => {})
  f.badges.watch('count', f.second, () => {})
  t.mock.timers.tick(0)
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].input.viewGraph.concepts.length, 1)
  f.calls[0].resolve({ value: 1 })
  await settle()
  t.mock.timers.tick(badgeLimits.rate)
  assert.equal(f.calls.length, 2)
  assert.equal(f.badges.getValue('count', f.first), 1)
  assert.equal(f.calls[1].input.viewGraph.concepts.length, 2)
  f.host.store.applyOperations([
    {
      kind: 'plugin-storage.set',
      pluginId: f.plugin.id,
      documentId: f.host.store.getState().documentId,
      revision: 0,
      record: { key: 'progress', conceptId: 'urn:a', value: 1 },
    },
  ])
  assert.equal(f.calls[1].signal.aborted, true)
  f.calls[1].resolve({ value: 99 })
  await settle()
  assert.equal(f.badges.getValue('count', f.first), null)
  assert.equal(f.badges.getValue('count', f.second), null)
  t.mock.timers.tick(badgeLimits.rate)
  assert.deepEqual(f.calls[2].input.records, [{ key: 'progress', conceptId: 'urn:a', value: 1 }])
  f.calls[2].resolve({ value: 2 })
  await settle()
  assert.equal(f.badges.getValue('count', f.first), 2)
})

test('refresh waits for its interval and foreground; losing the last consumer cancels execution', async (t) => {
  const f = fixture(t)
  const stop = f.badges.watch('count', f.first, () => {})
  t.mock.timers.tick(0)
  f.calls[0].resolve({ value: 1, refreshAt: Date.now() })
  await settle()
  t.mock.timers.tick(badgeLimits.refresh - 1)
  assert.equal(f.calls.length, 1)
  f.badges.setForeground(false)
  t.mock.timers.tick(badgeLimits.refresh * 10)
  assert.equal(f.calls.length, 1)
  f.badges.setForeground(true)
  t.mock.timers.tick(0)
  assert.equal(f.calls.length, 2)
  stop()
  assert.equal(f.calls[1].signal.aborted, true)
  f.calls[1].resolve({ value: 99 })
  await settle()
  t.mock.timers.tick(badgeLimits.refresh)
  assert.equal(f.calls.length, 2)
  assert.equal(f.badges.getValue('count', f.first), null)
})
