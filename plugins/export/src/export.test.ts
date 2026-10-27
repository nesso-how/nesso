import assert from 'node:assert/strict'
import test from 'node:test'
import { themeTokens, type ActionContext, type ActionState, type FileSaveOptions } from '@nesso-how/plugin/runtime'
import { createWriteCommands } from '@nesso-how/plugin'
import { create } from './index.ts'

test('export uses only the supplied target graph and notifies after accepted saves, not cancellation or failure', async (context) => {
  const state: ActionState = {
    revision: 0, contextId: 'export', locale: 'it', theme: Object.fromEntries(themeTokens.map((token) => [token, ''])), conceptPlacementOffset: { x: 160, y: 100 },
    viewGraph: { concepts: [{ id: 'urn:concept', label: 'One', position: { x: 0, y: 0 } }], relations: [], relationTypes: [] },
    targetViewId: 'urn:view', selected: [], activeVocab: null, history: { canUndo: false, canRedo: false },
    workspace: { activeViewId: 'urn:another', savedViews: [{ id: 'urn:view', name: 'Test view', pinned: false }] },
  }
  let finish: (value: { saved: boolean }) => void = () => {}
  const save = context.mock.fn((_options: FileSaveOptions) => new Promise<{ saved: boolean }>((resolve) => { finish = resolve }))
  const notify = context.mock.fn(async (_value: Parameters<ActionContext['notifications']['notify']>[0]) => 'notification')
  const api: ActionContext = {
    viewId: 'urn:view',
    store: { ...createWriteCommands(async () => assert.fail('Export must not write'), async (id, committed) => { await committed; return id }), getState: () => state, refresh: async () => state, subscribe: () => () => {}, applyOperations: async () => assert.fail('Export must not write') },
    files: { open: async () => assert.fail('Export must not open files'), save },
    notifications: { notify }, signal: new AbortController().signal,
  }
  const [action] = create()
  assert.equal(save.mock.callCount(), 0)
  assert.equal(action.label.en, 'Export json')
  const exporting = action.run(api)
  await Promise.resolve()
  assert.equal(save.mock.callCount(), 1)
  assert.equal(notify.mock.callCount(), 0)
  finish({ saved: true })
  await exporting
  assert.equal(save.mock.calls[0].arguments[0].name, 'nesso-test-view.jsonld')
  assert.equal(save.mock.calls[0].arguments[0].mediaType, 'application/ld+json')
  assert.ok(save.mock.calls[0].arguments[0].text.includes('urn:concept'))
  assert.deepEqual(notify.mock.calls[0].arguments[0].title, { en: 'View exported', it: 'Vista esportata', 'zh-CN': '视图已导出' })
  save.mock.mockImplementationOnce(async () => ({ saved: false }))
  await action.run(api)
  assert.equal(notify.mock.callCount(), 1)
  save.mock.mockImplementationOnce(async () => { throw new Error('Unavailable') })
  await assert.rejects(async () => action.run(api))
  assert.equal(notify.mock.callCount(), 1)
})
