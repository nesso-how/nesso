import assert from 'node:assert/strict'
import test from 'node:test'
import { createPluginInstaller } from './installer.ts'
import type { InstalledPlugin, NpmPlugin, PluginResult } from '../../shared/plugins.ts'

const target = (name: string) => ({ package: { name, version: '1.2.0', nesso: { apiVersion: 1, kind: 'actions', entry: 'index.js', writes: [], capabilities: [] }, i18n: { metadata: { name: { en: name }, description: { en: name }, documentation: { en: name } } } } satisfies NpmPlugin, replacing: `${name}-old-content` })

test('serial updates pin targets and report every failure, including the last batch item', async () => {
  const requested: string[] = []
  const notified: string[] = []
  const installer = createPluginInstaller({
    cancel: () => {},
    installNpm: async (_id, input, locale, replacing) => {
      requested.push(input.name)
      assert.equal(input.version, '1.2.0')
      assert.equal(locale, 'it')
      assert.equal(replacing, `${input.name}-old-content`)
      assert.deepEqual(notified, requested.slice(0, -1))
      return { issues: [{ path: 'npm', message: 'Integrity validation failed' }] }
    },
  }, () => 'it', ({ target, result }) => { assert.ok('issues' in result); notified.push(target.package.name) })
  await installer.start([target('first'), target('second'), target('last')])
  assert.deepEqual(requested, ['first', 'second', 'last'])
  assert.deepEqual(notified, requested)
  assert.equal(installer.getSnapshot().running, false)
})

test('declines and thrown errors continue the batch without hiding outcomes', async () => {
  const outcomes: PluginResult<InstalledPlugin | null>[] = []
  const installer = createPluginInstaller({ cancel: () => {}, installNpm: async (_id, input) => {
    if (input.name === 'declined') return { value: null }
    throw new Error('Private internal details')
  } }, () => 'en', ({ result }) => outcomes.push(result))
  await installer.start([target('declined'), target('failed')])
  assert.deepEqual(outcomes[0], { value: null })
  assert.ok('issues' in outcomes[1])
  assert.doesNotMatch(JSON.stringify(outcomes[1]), /Private internal/)
  assert.deepEqual(installer.getSnapshot().skipped, ['declined@1.2.0'])
})

test('cancellation skips queued packages but reports an already committed update as success', async () => {
  const pending = Promise.withResolvers<PluginResult<InstalledPlugin | null>>()
  const ids: string[] = []
  const cancelled: string[] = []
  const outcomes: PluginResult<InstalledPlugin | null>[] = []
  const installer = createPluginInstaller({ cancel: (id) => cancelled.push(id), installNpm: async (id) => { ids.push(id); return pending.promise } }, () => 'en', ({ result }) => outcomes.push(result))
  const running = installer.start([target('first'), target('second')])
  await installer.start([target('concurrent')])
  assert.equal(ids.length, 1)
  installer.receive({ type: 'install', id: ids[0], package: {} as InstalledPlugin })
  assert.equal(installer.getSnapshot().attempt?.installing, true)
  installer.cancel()
  const installed = { ...target('first').package, code: 'test', contentId: 'new-content', fonts: [], enabled: false }
  pending.resolve({ value: installed })
  await running
  assert.deepEqual(cancelled, ids)
  assert.equal(ids.length, 1)
  assert.deepEqual(outcomes, [{ value: installed }])
  assert.equal(installer.getSnapshot().updated, 'first@1.2.0')
  assert.equal(installer.getSnapshot().running, false)
  assert.deepEqual(installer.getSnapshot().skipped, ['second@1.2.0'])
})

test('successful updates retain earlier results while later batch items run', async () => {
  const pending: Array<PromiseWithResolvers<PluginResult<InstalledPlugin | null>>> = []
  const installer = createPluginInstaller({ cancel: () => {}, installNpm: async () => { const next = Promise.withResolvers<PluginResult<InstalledPlugin | null>>(); pending.push(next); return next.promise } }, () => 'en', () => {})
  const running = installer.start([target('first'), target('second')])
  while (pending.length < 1) await new Promise((resolve) => setTimeout(resolve, 0))
  pending[0].resolve({ value: { ...target('first').package, code: 'test', contentId: 'first-content', fonts: [], enabled: false } })
  while (pending.length < 2) await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(installer.getSnapshot().attempt?.name, 'second')
  assert.equal(installer.getSnapshot().updated, 'first@1.2.0')
  pending[1].resolve({ value: { ...target('second').package, code: 'test', contentId: 'second-content', fonts: [], enabled: false } })
  await running
  assert.equal(installer.getSnapshot().updated, 'second@1.2.0')
  assert.equal(installer.getSnapshot().running, false)
})

test('cancelled update batches retain attempted and queued skips until the next attempt', async () => {
  const pending = Promise.withResolvers<PluginResult<InstalledPlugin | null>>()
  const installer = createPluginInstaller({ cancel: () => {}, installNpm: async () => pending.promise }, () => 'en', () => {})
  const running = installer.start([target('first'), target('second'), target('third')])
  const before = installer.getSnapshot()
  installer.cancel()
  pending.resolve({ value: null })
  await running
  assert.deepEqual(before.skipped, [])
  assert.deepEqual(installer.getSnapshot().skipped, ['first@1.2.0', 'second@1.2.0', 'third@1.2.0'])
  await installer.start([{ package: target('new-install').package }])
  assert.deepEqual(installer.getSnapshot().skipped, [])
})
