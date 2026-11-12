import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import {
  badgeLimits,
  PluginError,
  type ActionBadgeInput,
  type ActionBadgeResult,
} from '@nesso-how/plugin/runtime'
import { createNessoStore } from '../store/create.ts'
import { createPluginRegistry, type PluginEntry } from './registry.ts'
import { createActionBadges } from './badges.ts'

function fixture(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  const host = createNessoStore({
    concepts: ['a', 'b'].map((id) => ({ id: `urn:${id}`, label: id })),
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
    reject: (error: PluginError) => void
  }[] = []
  const badges = createActionBadges(
    host.store,
    registry,
    (_plugin, _actionId, input, signal) =>
      new Promise<ActionBadgeResult>((resolve, reject) =>
        calls.push({ input, signal, resolve, reject }),
      ),
  )
  t.after(() => badges.dispose())
  return { host, first, second, plugin, registry, calls, badges }
}

const settle = () => Promise.resolve()

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
  f.host.store.renameView(f.first, 'Renamed')
  f.host.store.applyOperations([{ kind: 'view.pin', id: f.first, pinned: true }])
  assert.equal(f.badges.getValue('count', f.first), 1)
  assert.equal(f.calls[1].signal.aborted, false)
  f.host.store.applyOperations([
    {
      kind: 'plugin-storage.set',
      pluginId: f.plugin.id,
      local: false,
      documentId: f.host.store.getState().documentId,
      revision: 0,
      record: { key: 'progress', scope: { kind: 'concept', id: 'urn:a' }, value: 1 },
    },
  ])
  assert.equal(f.calls[1].signal.aborted, true)
  f.calls[1].resolve({ value: 99 })
  await settle()
  assert.equal(f.badges.getValue('count', f.first), 1)
  assert.equal(f.badges.getValue('count', f.second), null)
  t.mock.timers.tick(badgeLimits.rate)
  assert.deepEqual(f.calls[2].input.records, [
    { key: 'progress', scope: { kind: 'concept', id: 'urn:a' }, value: 1 },
  ])
  f.calls[2].resolve({ value: 2 })
  await settle()
  assert.equal(f.badges.getValue('count', f.first), 2)
  f.host.store.applyOperations([
    { kind: 'view.membership', viewId: f.second, conceptId: 'urn:b', included: false },
  ])
  assert.equal(f.badges.getValue('count', f.first), 2)
  t.mock.timers.tick(badgeLimits.rate)
  assert.equal(f.calls[3].input.viewGraph.concepts.length, 1)
})

test('cached results survive consumers until refresh; foreground and last-consumer cancellation remain enforced', async (t) => {
  const f = fixture(t)
  let stop = f.badges.watch('count', f.first, () => {})
  t.mock.timers.tick(0)
  f.calls[0].resolve({ value: 1, refreshAt: Date.now() })
  await settle()
  stop()
  assert.equal(f.badges.getValue('count', f.first), 1)
  stop = f.badges.watch('count', f.first, () => {})
  t.mock.timers.tick(badgeLimits.refresh - 1)
  assert.equal(f.calls.length, 1)
  f.badges.setForeground(false)
  t.mock.timers.tick(badgeLimits.refresh * 10)
  assert.equal(f.calls.length, 1)
  f.badges.setForeground(true)
  t.mock.timers.tick(0)
  assert.equal(f.calls.length, 2)
  assert.equal(f.badges.getValue('count', f.first), 1)
  stop()
  assert.equal(f.calls[1].signal.aborted, true)
  f.calls[1].resolve({ value: 99 })
  await settle()
  t.mock.timers.tick(badgeLimits.refresh)
  assert.equal(f.calls.length, 2)
  assert.equal(f.badges.getValue('count', f.first), null)
  stop = f.badges.watch('count', f.first, () => {})
  t.mock.timers.tick(0)
  assert.equal(f.calls.length, 3)
  f.calls[2].resolve({ value: 2, refreshAt: Date.now() })
  await settle()
  stop()
  t.mock.timers.tick(badgeLimits.refresh)
  assert.equal(f.calls.length, 3)
  assert.equal(f.badges.getValue('count', f.first), null)
  stop = f.badges.watch('count', f.first, () => {})
  t.mock.timers.tick(0)
  assert.equal(f.calls.length, 4)
  f.calls[3].resolve({ value: 3 })
  await settle()
  f.badges.dispose()
  stop()
  assert.equal(f.badges.getValue('count', f.first), null)
})

test('observed badges retain their count during refresh but clear on failures and hard invalidation', async (t) => {
  const f = fixture(t)
  const values: (number | null)[] = []
  const stop = f.badges.watch('count', f.first, () =>
    values.push(f.badges.getValue('count', f.first)),
  )
  t.mock.timers.tick(0)
  f.calls[0].resolve({ value: 1 })
  await settle()
  f.host.store.setConceptLabel('urn:a', 'Changed')
  assert.equal(f.badges.getValue('count', f.first), 1)
  t.mock.timers.tick(badgeLimits.rate)
  assert.equal(f.badges.getValue('count', f.first), 1)
  f.calls[1].resolve({ value: 1 })
  await settle()
  assert.equal(
    values.every((value) => value === 1),
    true,
  )
  f.host.store.applyOperations([
    { kind: 'view.membership', viewId: f.first, conceptId: 'urn:b', included: true },
  ])
  assert.equal(f.badges.getValue('count', f.first), 1)
  t.mock.timers.tick(badgeLimits.rate)
  f.calls[2].resolve({ value: 0 })
  await settle()
  assert.equal(f.badges.getValue('count', f.first), 0)
  f.host.store.setConceptLabel('urn:a', 'Changed again')
  assert.equal(f.badges.getValue('count', f.first), 0)
  t.mock.timers.tick(badgeLimits.rate)
  f.calls[3].reject(new PluginError('failed', [{ path: 'badge', message: 'Provider failed' }]))
  await settle()
  assert.equal(f.badges.getValue('count', f.first), null)
  stop()
  for (const reason of ['document', 'plugin', 'view', 'execution'] as const) {
    f.registry.replace([f.plugin])
    const view = f.host.store.createView(
      'Observed',
      f.host.store.getState().graph.concepts.map(({ id }) => id),
    )
    const stop = f.badges.watch('count', view, () => {})
    t.mock.timers.tick(badgeLimits.rate)
    f.calls.at(-1)!.resolve({ value: 2 })
    await settle()
    assert.equal(f.badges.getValue('count', view), 2)
    f.host.store.setConceptLabel(f.host.store.getState().graph.concepts[0].id, `Pending ${reason}`)
    t.mock.timers.tick(badgeLimits.rate)
    const pending = f.calls.at(-1)!
    assert.equal(f.badges.getValue('count', view), 2)
    if (reason === 'document')
      f.host.store.applyOperations([
        { kind: 'document.reset', id: f.host.store.getState().documentId },
      ])
    if (reason === 'plugin') f.registry.replace([{ ...f.plugin, disabled: true }])
    if (reason === 'view') f.host.store.deleteView(view)
    if (reason === 'execution') f.badges.invalidatePlugin(f.plugin.id)
    assert.equal(f.badges.getValue('count', view), null, reason)
    assert.equal(pending.signal.aborted, true, reason)
    pending.resolve({ value: 99 })
    await settle()
    assert.equal(f.badges.getValue('count', view), null, reason)
    stop()
  }
})

test('inactive cache is bounded, ignores view metadata and is invalidated by graph or storage changes', async (t) => {
  const f = fixture(t)
  const views = Array.from({ length: 65 }, (_, index) =>
    f.host.store.createView(`Cached ${index}`, ['urn:a']),
  )
  for (const view of views) {
    const stop = f.badges.watch('count', view, () => {})
    t.mock.timers.tick(badgeLimits.rate)
    f.calls.at(-1)!.resolve({ value: 1 })
    await settle()
    stop()
  }
  assert.equal(f.badges.getValue('count', views[0]), null)
  assert.equal(f.badges.getValue('count', views[1]), 1)
  const stop = f.badges.watch('count', views[1], () => {})
  t.mock.timers.tick(badgeLimits.rate)
  assert.equal(f.calls.length, 65)
  stop()
  const stopOverview = f.badges.watch('count', null, () => {})
  t.mock.timers.tick(badgeLimits.rate)
  f.calls.at(-1)!.resolve({ value: 3 })
  await settle()
  stopOverview()
  f.host.store.renameView(views[1], 'Renamed')
  f.host.store.applyOperations([{ kind: 'view.pin', id: views[1], pinned: true }])
  assert.equal(f.badges.getValue('count', views[1]), 1)
  f.host.store.applyOperations([
    { kind: 'view.membership', viewId: views[1], conceptId: 'urn:b', included: true },
  ])
  assert.equal(f.badges.getValue('count', views[1]), null)
  assert.equal(f.badges.getValue('count', null), 3)
  f.host.store.setConceptLabel('urn:a', 'Changed')
  assert.equal(f.badges.getValue('count', views[2]), null)
  assert.equal(f.badges.getValue('count', null), null)
  const stopStorage = f.badges.watch('count', null, () => {})
  t.mock.timers.tick(badgeLimits.rate)
  f.calls.at(-1)!.resolve({ value: 2 })
  await settle()
  stopStorage()
  assert.equal(f.badges.getValue('count', null), 2)
  f.host.store.applyOperations([
    {
      kind: 'plugin-storage.set',
      pluginId: f.plugin.id,
      local: false,
      documentId: f.host.store.getState().documentId,
      revision: 0,
      record: { key: 'progress', value: 1 },
    },
  ])
  assert.equal(f.badges.getValue('count', null), null)
})
