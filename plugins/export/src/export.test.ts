import assert from 'node:assert/strict'
import test from 'node:test'
import {
  themeTokens,
  type ActionContext,
  type ActionState,
  type FileSaveOptions,
} from '@nesso-how/plugin/runtime'
import { createWriteCommands } from '@nesso-how/core'
import { parseGraph } from '@nesso-how/schema'
import { create } from './index.ts'

test('export uses only the supplied target graph and notifies after accepted saves, not cancellation or failure', async (context) => {
  const state: ActionState = {
    revision: 0,
    contextId: 'export',
    locale: 'it',
    theme: Object.fromEntries(themeTokens.map((token) => [token, ''])),
    colorScheme: 'light',
    conceptPlacementOffset: { x: 160, y: 100 },
    mapGraph: {
      concepts: [
        { id: 'urn:concept', label: 'One', position: { x: 0, y: 0 }, strikethrough: true },
        { id: 'urn:other', label: 'Two', position: { x: 160, y: 0 } },
      ],
      relations: [
        { source: 'urn:concept', predicate: 'urn:links', target: 'urn:other', bend: 0.25 },
      ],
      relationTypes: [{ id: 'urn:links', label: 'links' }],
    },
    targetMapId: 'urn:map',
    selected: [],
    activeVocab: null,
    history: { canUndo: false, canRedo: false },
    workspace: {
      activeMapId: 'urn:another',
      maps: [{ id: 'urn:map', name: 'Test map', pinned: false }],
    },
  }
  let finish: (value: { saved: boolean }) => void = () => {}
  const save = context.mock.fn(
    (_options: FileSaveOptions) =>
      new Promise<{ saved: boolean }>((resolve) => {
        finish = resolve
      }),
  )
  const notify = context.mock.fn(
    async (_value: Parameters<ActionContext['notifications']['notify']>[0]) => 'notification',
  )
  const noStorage = async () => assert.fail('Export must not access plugin storage')
  const api: ActionContext = {
    mapId: 'urn:map',
    document: {
      ...createWriteCommands(
        async () => assert.fail('Export must not write'),
        async (id, committed) => {
          await committed
          return id
        },
      ),
      getState: () => state,
      refresh: async () => state,
      subscribe: () => () => {},
      applyOperations: async () => assert.fail('Export must not write'),
    },
    files: { open: async () => assert.fail('Export must not open files'), save },
    images: { renderMap: async () => assert.fail('JSON-LD export must not render images') },
    storage: { list: noStorage, set: noStorage, delete: noStorage },
    notifications: { notify },
    signal: new AbortController().signal,
  }
  const [action] = create()
  assert.ok(action.run)
  assert.equal(save.mock.callCount(), 0)
  assert.equal(action.label.en, 'Export json')
  const exporting = action.run(api)
  await Promise.resolve()
  assert.equal(save.mock.callCount(), 1)
  assert.equal(notify.mock.callCount(), 0)
  finish({ saved: true })
  await exporting
  assert.equal(save.mock.calls[0].arguments[0].name, 'nesso-test-map.jsonld')
  assert.equal(save.mock.calls[0].arguments[0].mediaType, 'application/ld+json')
  const written = save.mock.calls[0].arguments[0]
  assert.ok('text' in written && written.text.includes('urn:concept'))
  const exported = parseGraph(JSON.parse(written.text))
  assert.equal(exported.maps[0].members[0].strikethrough, true)
  assert.deepEqual(exported.graph.relations, [
    { source: 'urn:concept', predicate: 'urn:links', target: 'urn:other' },
  ])
  assert.deepEqual(exported.maps[0].relationBends, state.mapGraph.relations)
  assert.deepEqual(notify.mock.calls[0].arguments[0].title, {
    en: 'Map exported',
    it: 'Mappa esportata',
    'zh-CN': '导图已导出',
  })
  save.mock.mockImplementationOnce(async () => ({ saved: false }))
  await action.run(api)
  assert.equal(notify.mock.callCount(), 1)
  save.mock.mockImplementationOnce(async () => {
    throw new Error('Unavailable')
  })
  await assert.rejects(async () => action.run(api))
  assert.equal(notify.mock.callCount(), 1)
})
