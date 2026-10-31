import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPluginClient,
  themeTokens,
  runtimeLimits,
  PluginError,
  type ActionDescriptor,
  type FileOpenResult,
} from '@nesso-how/plugin/runtime'
import { createNessoStore } from '../store/create.ts'
import { connectActionChannel } from './action-channel.ts'
import type { NessoOperation } from '@nesso-how/core'

const descriptors: readonly ActionDescriptor[] = [{ id: 'example', label: { en: 'Example' } }]
const base = {
  contextId: 'context',
  locale: 'en' as const,
  theme: Object.fromEntries(themeTokens.map((token) => [token, ''])),
  conceptPlacementOffset: { x: 160, y: 100 },
}
const graph = {
  concepts: [
    { id: 'urn:a', label: 'A', position: { x: 0, y: 0 } },
    { id: 'urn:b', label: 'B', position: { x: 100, y: 0 } },
  ],
  relationTypes: [],
  relations: [],
}

function fixture(
  discovery = false,
  open: () => Promise<FileOpenResult> = async () => null,
  writes: readonly NessoOperation['kind'][] = ['concept.label', 'concept.color'],
  capabilities: readonly string[] = ['files'],
  host = createNessoStore(graph),
  pluginId = 'nesso-plugin-example',
  panel = false,
) {
  const contributions = panel
    ? descriptors.map((action) => ({ ...action, ui: true as const }))
    : descriptors
  const target = host.store.createView('Target', ['urn:a'])
  host.store.setView(null)
  host.store.setSelection([{ kind: 'concept', id: 'urn:b' }])
  const channel = new MessageChannel()
  const failures: PluginError[] = []
  const found: (readonly ActionDescriptor[])[] = []
  const notified: string[] = []
  const descriptions: (string | undefined)[] = []
  const dismissed: string[] = []
  const runtime = connectActionChannel(
    channel.port1,
    host.store,
    {
      pluginId,
      writes,
      capabilities,
      ...(panel ? { mode: 'panel' } : {}),
      invocation: discovery
        ? undefined
        : { actionId: 'example', viewId: target, descriptors: contributions },
    },
    base,
    {
      files: { open, save: async () => ({ saved: true }) },
      notify: ({ title, description }) => {
        notified.push(title)
        descriptions.push(description)
        return title
      },
      dismiss: (id) => {
        dismissed.push(id)
      },
      discovered: (value) => found.push(value),
      activated: () => {},
      complete: () => {},
      failed: (error) => failures.push(error),
    },
  )
  let client: ReturnType<typeof createPluginClient> | undefined
  const messages: { type: string }[] = []
  channel.port2.addEventListener('message', ({ data }) => messages.push(data))
  channel.port2.start()
  const start = (value = contributions) =>
    new Promise<void>((resolve, reject) => {
      channel.port2.onmessage = ({ data }) => {
        if (data.type === 'invoke') {
          client = createPluginClient(channel.port2, data.state)
          if (panel) channel.port2.postMessage({ type: 'panel-ready' })
          resolve()
        }
        if (data.type === 'close') {
          if (discovery) resolve()
          else reject(new PluginError('closed', [{ path: 'channel', message: data.reason }]))
        }
      }
      channel.port2.postMessage(panel ? { type: 'panel-ready' } : { type: 'contribution', value })
    })
  const close = () => {
    runtime.close()
    client?.close()
    channel.port2.close()
  }
  return {
    host,
    target,
    channel,
    runtime,
    get client() {
      assert.ok(client)
      return client
    },
    messages,
    failures,
    found,
    notified,
    descriptions,
    dismissed,
    start,
    close,
  }
}

test('action projections stay bound to the invoked view, filter off-view selection and synchronize atomic writes', async (t) => {
  const instance = fixture()
  t.after(instance.close)
  instance.host.store.setConceptLabel('urn:a', 'Before invocation')
  await instance.start()
  const { document } = instance.client.context
  const before = document.getState()
  assert.equal(instance.client.context.viewId, instance.target)
  assert.equal(before.viewGraph.concepts[0].label, 'Before invocation')
  assert.equal('graph' in before, false)
  assert.equal('conversation' in before, false)
  assert.equal('pluginStorage' in before, false)
  assert.deepEqual(
    before.viewGraph.concepts.map(({ id }) => id),
    ['urn:a'],
  )
  assert.deepEqual(before.selected, [])
  assert.equal('conceptIds' in before.workspace.savedViews[0], false)
  instance.host.store.setView(instance.target)
  await document.refresh()
  await document.applyOperations([{ kind: 'concept.label', id: 'urn:a', value: 'Changed' }])
  const state = document.getState()
  assert.equal(state.targetViewId, instance.target)
  assert.equal(state.viewGraph.concepts[0].label, 'Changed')
  assert.equal('getViewGraph' in document, false)
  await assert.rejects(
    document.applyOperations([
      { kind: 'concept.label', id: 'urn:a', value: 'No' },
      { kind: 'concept.remove', id: 'urn:b' },
    ]),
    { code: 'denied' },
  )
  await document.applyOperations([{ kind: 'concept.color', id: 'urn:a', value: '#123456' }])
  assert.equal(instance.host.store.getState().graph.concepts[0].color, '#123456')
})

test('injected panel presentation updates never advance the graph write baseline', async (t) => {
  const instance = fixture(false, undefined, ['concept.label'], ['ui'], undefined, undefined, true)
  t.after(instance.close)
  await instance.start()
  const { document } = instance.client.context
  const original = document.getState().viewGraph.concepts[0].label
  document.subscribe(() => instance.client.getPresentation())
  instance.host.store.setConceptLabel('urn:a', 'Concurrent edit')
  instance.host.store.setLocale('it')
  await assert.rejects(instance.client.context.storage.list(), { code: 'denied' })
  assert.equal(instance.client.getPresentation().locale, 'it')
  await assert.rejects(document.setConceptLabel('urn:a', original.toUpperCase()), {
    code: 'stale-state',
  })
  assert.equal(instance.host.store.getState().graph.concepts[0].label, 'Concurrent edit')
})

test('panel sessions have heartbeats rather than a bounded action lifetime', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] })
  const instance = fixture(false, undefined, [], ['ui'], undefined, undefined, true)
  t.after(instance.close)
  await instance.start()
  await instance.client.context.document.refresh()
  for (let time = 0; time <= runtimeLimits.action * 2; time += runtimeLimits.heartbeat) {
    t.mock.timers.tick(runtimeLimits.heartbeat)
    await instance.client.context.document.refresh()
  }
  assert.equal(instance.failures.length, 0)
  instance.channel.port2.onmessage = null
  t.mock.timers.tick(runtimeLimits.heartbeat * 2)
  assert.equal(instance.failures[0].code, 'timeout')
  assert.equal(instance.runtime.signal.aborted, true)
})

test('panel initialization and action execution cannot bypass their accepted execution modes', async (t) => {
  const undeclared = fixture(false, undefined, [], [], undefined, undefined, true)
  t.after(undeclared.close)
  await assert.rejects(undeclared.start(), { code: 'closed' })
  assert.equal(undeclared.failures[0].code, 'denied')
  const discovery = fixture(true)
  t.after(discovery.close)
  discovery.channel.port2.postMessage({ type: 'panel-ready' })
  await new Promise<void>((resolve) => {
    discovery.channel.port2.onmessage = () => resolve()
  })
  assert.equal(discovery.failures[0].code, 'denied')
})

test('plugin batches and helpers automatically reject stale reads without changes or retries', async (t) => {
  for (const delivered of [false, true]) {
    const instance = fixture()
    t.after(instance.close)
    await instance.start()
    const { document, files } = instance.client.context
    const snapshot = document.getState()
    instance.host.store.setConceptLabel('urn:a', 'Newer edit')
    if (delivered) await files.open({ extensions: ['json'], mimeTypes: [] })
    const before = instance.host.store.getState()
    await assert.rejects(
      document.applyOperations([
        { kind: 'concept.color', id: 'urn:a', value: '#123456' },
        {
          kind: 'concept.label',
          id: 'urn:a',
          value: snapshot.viewGraph.concepts[0].label.toUpperCase(),
        },
      ]),
      { code: 'stale-state' },
    )
    await assert.rejects(document.setConceptLabel('urn:a', 'Still stale'), { code: 'stale-state' })
    assert.equal(instance.host.store.getState(), before)
    assert.equal(instance.host.store.getState().graph.concepts[0].label, 'Newer edit')
    if (delivered) document.getState()
    else await document.refresh()
    await document.setConceptLabel('urn:a', 'Recomputed')
    await document.setConceptColor('urn:a', '#123456')
    assert.equal(instance.host.store.getState().graph.concepts[0].label, 'Recomputed')
    assert.equal(instance.host.store.getState().graph.concepts[0].color, '#123456')
  }
})

test('isolated clients have no clipboard API and raw clipboard requests close the channel without effects', async (t) => {
  for (const method of ['clipboard.readText', 'clipboard.writeText']) {
    const instance = fixture()
    t.after(instance.close)
    await instance.start()
    assert.equal('clipboard' in instance.client.context, false)
    const before = instance.host.store.getState()
    instance.channel.port2.postMessage({
      type: 'request',
      id: 1000,
      contextId: base.contextId,
      method,
      params: method === 'clipboard.writeText' ? { text: 'Forbidden' } : {},
    })
    await assert.rejects(instance.client.context.document.refresh(), { code: 'closed' })
    assert.equal(instance.failures[0].code, 'invalid-input')
    assert.equal(instance.host.store.getState(), before)
  }
})

test('files capability is required for both opening and saving', async (t) => {
  const open = t.mock.fn(async () => null)
  const denied = fixture(false, open, [], ['storage', 'notifications'])
  const allowed = fixture(false, open, [], ['files'])
  for (const instance of [denied, allowed]) {
    t.after(instance.close)
    await instance.start()
  }
  const read = { extensions: ['json'], mimeTypes: [] }
  const write = { name: 'example.json', mediaType: 'application/json', text: '{}' }
  await assert.rejects(denied.client.context.files.open(read), { code: 'denied' })
  await assert.rejects(denied.client.context.files.save(write), { code: 'denied' })
  assert.equal(open.mock.callCount(), 0)
  assert.equal(await allowed.client.context.files.open(read), null)
  assert.deepEqual(await allowed.client.context.files.save(write), { saved: true })
  assert.equal(open.mock.callCount(), 1)
})

test('notifications require a declared capability and retain host rate limits and revocation', async (t) => {
  const denied = fixture()
  t.after(denied.close)
  await denied.start()
  await assert.rejects(
    denied.client.context.notifications.notify({ tone: 'info', title: { en: 'Undeclared' } }),
    { code: 'denied' },
  )
  assert.deepEqual(denied.notified, [])
  const allowed = fixture(false, undefined, [], ['notifications'])
  t.after(allowed.close)
  await allowed.start()
  for (let index = 0; index < 10; index++)
    assert.equal(
      await allowed.client.context.notifications.notify({
        tone: 'info',
        title: { en: `Notice ${index}` },
      }),
      `Notice ${index}`,
    )
  await assert.rejects(
    allowed.client.context.notifications.notify({ tone: 'info', title: { en: 'Over limit' } }),
    { code: 'denied' },
  )
  assert.equal(allowed.notified.length, 10)
  assert.deepEqual(allowed.dismissed, allowed.notified.slice(0, 5))
  allowed.runtime.close()
  await assert.rejects(
    allowed.client.context.notifications.notify({ tone: 'info', title: { en: 'Late' } }),
    { code: 'closed' },
  )
  assert.equal(allowed.notified.length, 10)
  assert.deepEqual(allowed.dismissed, allowed.notified)
})

test('the host resolves notification text in the current locale and preserves localized action failures', async (t) => {
  const instance = fixture(false, undefined, [], ['notifications'])
  t.after(instance.close)
  await instance.start()
  instance.host.store.setLocale('it')
  const notification = {
    tone: 'info' as const,
    title: { en: 'Notice', it: 'Avviso' },
    description: { en: 'English fallback' },
  }
  assert.equal(await instance.client.context.notifications.notify(notification), 'Avviso')
  instance.host.store.setLocale('zh-CN')
  assert.equal(await instance.client.context.notifications.notify(notification), 'Notice')
  assert.deepEqual(instance.notified, ['Avviso', 'Notice'])
  assert.deepEqual(instance.descriptions, ['English fallback', 'English fallback'])
  const displayMessage = { en: 'Failed', it: 'Operazione fallita' }
  instance.channel.port2.postMessage({
    type: 'complete',
    ok: false,
    error: {
      code: 'failed',
      issues: [{ path: 'action', message: 'Technical failure' }],
      displayMessage,
    },
  })
  await assert.rejects(instance.client.context.document.refresh(), { code: 'closed' })
  assert.deepEqual(instance.failures[0].displayMessage, displayMessage)
  assert.deepEqual(instance.failures[0].issues, [{ path: 'action', message: 'Technical failure' }])
})

test('discovery sends no state and denies requests; invocation rejects changed descriptors', async (t) => {
  const discovery = fixture(true, undefined, undefined, ['files', 'notifications', 'storage'])
  t.after(discovery.close)
  let id = 0
  for (const [method, params] of [
    ['document.refresh', {}],
    ['document.applyOperations', { operations: [], revision: 0 }],
    ['files.open', { extensions: ['json'], mimeTypes: [] }],
    ['notifications.notify', { tone: 'info', title: { en: 'Denied' } }],
    ['storage.list', {}],
    ['storage.set', { revision: 0, key: 'denied', value: 0 }],
    ['storage.delete', { revision: 0, key: 'denied' }],
  ]) {
    const response = new Promise((resolve) =>
      discovery.channel.port2.addEventListener('message', ({ data }) => resolve(data), {
        once: true,
      }),
    )
    discovery.channel.port2.postMessage({
      type: 'request',
      id: ++id,
      contextId: base.contextId,
      method,
      params,
    })
    assert.deepEqual(await response, {
      type: 'response',
      id,
      ok: false,
      error: {
        code: 'denied',
        issues: [{ path: 'action', message: 'Action effects are disabled' }],
      },
    })
  }
  discovery.host.store.setConceptLabel('urn:a', 'Not exposed')
  await discovery.start()
  assert.ok(discovery.messages.every(({ type }) => type === 'response' || type === 'close'))
  assert.deepEqual(discovery.found, [descriptors])
  const invocation = fixture()
  t.after(invocation.close)
  await assert.rejects(invocation.start([{ ...descriptors[0], label: { en: 'Changed' } }]), {
    code: 'closed',
  })
  assert.equal(invocation.failures[0].code, 'denied')
})

test('typed plugin writes are asynchronous, synchronize snapshots and preserve validation, declarations and history groups', async (t) => {
  const instance = fixture(false, undefined, ['concept.label', 'concept.color', 'concept.notes'])
  t.after(instance.close)
  await instance.start()
  const { document } = instance.client.context
  const before = instance.host.store.getState()
  const pending = document.setConceptLabel('urn:a', 'First', 'edit')
  assert.ok(pending instanceof Promise)
  assert.equal(instance.host.store.getState(), before)
  assert.equal(await pending, undefined)
  await document.setConceptLabel('urn:a', 'Second', 'edit')
  const state = document.getState()
  assert.equal(state.viewGraph.concepts[0].label, 'Second')
  await document.setConceptLabel('urn:a', 'Second', 'edit')
  assert.equal(document.getState(), state)
  await assert.rejects(document.setConceptLabel('urn:a', 'x'.repeat(300)), {
    code: 'invalid-input',
  })
  const committed = instance.host.store.getState()
  await assert.rejects(document.addConcept(), { code: 'denied' })
  assert.equal('createView' in document, false)
  assert.equal('setView' in document, false)
  assert.equal('undo' in document, false)
  assert.equal(instance.host.store.getState(), committed)
  await document.setConceptColor('urn:a', '#123456')
  assert.equal(instance.host.store.getState().graph.concepts[0].color, '#123456')
  await document.setConceptNotes('urn:a', 'Notes')
  assert.equal(instance.host.store.getState().graph.concepts[0].notes, 'Notes')
  instance.host.store.setConceptLabel('urn:a', 'Host edit', 'edit')
  await document.refresh()
  await document.setConceptLabel('urn:a', 'Plugin edit', 'edit')
  assert.equal(instance.host.store.getState().graph.concepts[0].label, 'Plugin edit')
  assert.equal(
    'resetGraph' in document || 'setViewport' in document || 'setActiveRenderer' in document,
    false,
  )
})

test('concept colors cross isolated snapshots and declared commands with atomic validation', async (t) => {
  const denied = fixture(false, undefined, ['concept.label'])
  t.after(denied.close)
  await denied.start()
  await assert.rejects(denied.client.context.document.setConceptColor('urn:a', '#654321'), {
    code: 'denied',
  })
  const instance = fixture(false, undefined, ['concept.color', 'concept.label'])
  t.after(instance.close)
  instance.host.store.setConceptColor('urn:a', '#123456')
  await instance.start()
  const { document } = instance.client.context
  const color = () => {
    const state = document.getState()
    return state.viewGraph.concepts[0].color
  }
  assert.equal(color(), '#123456')
  await document.setConceptColor('urn:a', '#ABCDEF')
  assert.equal(color(), '#abcdef')
  const before = instance.host.store.getState()
  await assert.rejects(document.setConceptColor('urn:a', 'red'), { code: 'invalid-input' })
  assert.equal(instance.host.store.getState(), before)
  await document.setConceptColor('urn:a', '')
  assert.equal(color(), undefined)
  await document.setConceptColor('urn:a', '#abcdef')
  assert.equal(color(), '#abcdef')
  await document.setConceptColor('urn:a', '#123456')
  assert.equal(color(), '#123456')
})

test('declared writes reject relative graph identifiers atomically without changing snapshots or history', async (t) => {
  const instance = fixture(false, undefined, ['concept.add', 'concept.label', 'relation.connect'])
  t.after(instance.close)
  await instance.start()
  const { document } = instance.client.context
  const before = instance.host.store.getState()
  const snapshot = document.getState()
  for (const operation of [
    { kind: 'concept.add', id: 'relative-concept' },
    {
      kind: 'relation.connect',
      source: 'urn:a',
      target: 'urn:b',
      type: { id: 'relative-type', label: 'Invalid' },
    },
  ] satisfies NessoOperation[]) {
    await assert.rejects(
      document.applyOperations([
        { kind: 'concept.label', id: 'urn:a', value: 'Must roll back' },
        operation,
      ]),
      { code: 'invalid-input' },
    )
    assert.equal(instance.host.store.getState(), before)
    assert.equal(document.getState(), snapshot)
  }
})

test('plugin creation helpers resolve stable IDs after commit and reject failed or closed requests without publishing IDs', async (t) => {
  const instance = fixture(false, undefined, ['concept.add', 'concept.label'])
  t.after(instance.close)
  await instance.start()
  instance.host.store.setView(instance.target)
  instance.host.store.setSelection([])
  const { document } = instance.client.context
  await document.refresh()
  assert.equal('createView' in document, false)
  const concept = await document.addConcept({ x: 40, y: 50 })
  const state = document.getState()
  assert.ok(state.viewGraph.concepts.some(({ id }) => id === concept))
  assert.ok(instance.host.store.getState().workspace.savedViews[0].conceptIds.includes(concept))
  await document.setConceptLabel(concept, 'Created', 'edit')
  const created = document.getState()
  assert.equal(created.viewGraph.concepts.find(({ id }) => id === concept)?.label, 'Created')
  const committed = instance.host.store.getState()
  assert.equal(committed.graph.concepts.find(({ id }) => id === concept)?.label, 'Created')
  await assert.rejects(document.addConcept({ x: NaN, y: 0 }), { code: 'invalid-input' })
  await assert.rejects(document.setConceptLabel(concept, 'x'.repeat(300)), {
    code: 'invalid-input',
  })
  assert.equal(instance.host.store.getState(), committed)
  instance.runtime.close()
  await assert.rejects(document.addConcept(), { code: 'closed' })
  await assert.rejects(document.setConceptLabel(concept, 'Closed'), { code: 'closed' })
  assert.equal(instance.host.store.getState(), committed)
})

test('pending file work survives navigation but target deletion revokes it and prevents late effects', async (t) => {
  let resolve: (value: FileOpenResult) => void = () => {}
  let began: () => void = () => {}
  const started = new Promise<void>((done) => {
    began = done
  })
  const instance = fixture(false, () => {
    began()
    return new Promise((done) => {
      resolve = done
    })
  })
  t.after(instance.close)
  await instance.start()
  const result = instance.client.context.files.open({ extensions: ['json'], mimeTypes: [] })
  await started
  instance.host.store.setView(instance.target)
  await instance.client.context.document.refresh()
  await assert.rejects(
    instance.client.context.files.open({ extensions: ['json'], mimeTypes: [] }),
    { code: 'unavailable' },
  )
  instance.host.store.deleteView(instance.target)
  await assert.rejects(result, { code: 'closed' })
  assert.equal(instance.failures[0].code, 'stale-context')
  resolve({ name: 'late.json', mediaType: 'application/json', text: '{}' })
  await assert.rejects(
    instance.client.context.document.applyOperations([
      { kind: 'concept.label', id: 'urn:a', value: 'Late' },
    ]),
    { code: 'closed' },
  )
  assert.equal(instance.host.store.getState().graph.concepts[0].label, 'A')
})

test('host deadlines revoke running actions and pause only within the bounded file interaction budget', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  const running = fixture()
  t.after(running.close)
  await running.start()
  t.mock.timers.tick(runtimeLimits.action)
  assert.equal(running.runtime.signal.aborted, true)
  assert.equal(running.failures[0].code, 'timeout')
  let began: () => void = () => {}
  const started = new Promise<void>((resolve) => {
    began = resolve
  })
  const waiting = fixture(false, () => {
    began()
    return new Promise(() => {})
  })
  t.after(waiting.close)
  await waiting.start()
  const result = waiting.client.context.files.open({ extensions: ['json'], mimeTypes: [] })
  const rejected = assert.rejects(result, { code: 'closed' })
  await started
  t.mock.timers.tick(runtimeLimits.action)
  assert.equal(waiting.runtime.signal.aborted, false)
  t.mock.timers.tick(runtimeLimits.interaction - runtimeLimits.action)
  await rejected
  assert.equal(waiting.runtime.signal.aborted, true)
  assert.equal(waiting.failures[0].code, 'timeout')
})

test('storage capability authorizes listing and single writes independently of graph revisions and history', async (t) => {
  const denied = fixture()
  t.after(denied.close)
  await denied.start()
  await assert.rejects(denied.client.context.storage.list(), { code: 'denied' })
  await assert.rejects(denied.client.context.storage.set('settings', null), { code: 'denied' })
  await assert.rejects(denied.client.context.storage.delete('settings'), { code: 'denied' })
  const writable = fixture(false, undefined, ['concept.label'], ['storage'])
  t.after(writable.close)
  await writable.start()
  const before = writable.host.store.getState()
  const snapshot = writable.client.context.document.getState()
  assert.deepEqual(await writable.client.context.storage.list(), [])
  const result = writable.client.context.storage.set('settings', { retention: 0.9 })
  assert.equal(writable.host.store.getState(), before)
  assert.equal(await result, true)
  assert.equal(writable.host.store.getState().graph, before.graph)
  assert.equal(writable.host.store.getState().history, before.history)
  assert.equal(writable.client.context.document.getState(), snapshot)
  await writable.client.context.document.setConceptLabel('urn:a', 'Still current')
  assert.equal(await writable.client.context.storage.set('settings', { retention: 0.9 }), false)
  await assert.rejects(writable.client.context.storage.set('bad', null, 'urn:missing'), {
    code: 'invalid-input',
  })
  await assert.rejects(writable.client.context.storage.set('bad', null, 'relative'), {
    code: 'invalid-input',
  })
  assert.equal(await writable.client.context.storage.delete('settings', 'relative'), false)
  assert.equal(await writable.client.context.storage.delete('settings'), true)
  assert.deepEqual(await writable.client.context.storage.list(), [])
})

test('storage namespaces follow granted package identity, synchronize across instances and reject stale writes without retries', async (t) => {
  const capabilities = ['storage']
  const first = fixture(false, undefined, [], capabilities)
  const second = fixture(false, undefined, [], capabilities, first.host)
  const other = fixture(false, undefined, [], capabilities, first.host, 'nesso-plugin-other')
  for (const instance of [first, second, other]) {
    t.after(instance.close)
    await instance.start()
  }
  const firstStorage = first.client.context.storage
  const secondStorage = second.client.context.storage
  assert.deepEqual(await firstStorage.list(), [])
  assert.equal(await firstStorage.set('settings', { enabled: true }), true)
  assert.equal(await firstStorage.set('progress', { count: 1 }, 'urn:b'), true)
  const shared = await secondStorage.list()
  assert.equal(shared.length, 2)
  assert.ok(shared.every((record) => !('pluginId' in record)))
  assert.deepEqual(await other.client.context.storage.list(), [])
  await firstStorage.set('settings', { enabled: false })
  const before = first.host.store.getState()
  await assert.rejects(secondStorage.set('settings', { enabled: true }), { code: 'stale-state' })
  await second.client.context.document.refresh()
  await assert.rejects(secondStorage.delete('settings'), { code: 'stale-state' })
  assert.equal(first.host.store.getState(), before)
  assert.deepEqual((await secondStorage.list()).find(({ key }) => key === 'settings')?.value, {
    enabled: false,
  })
  assert.equal(await secondStorage.set('settings', { enabled: true }), true)
  await other.client.context.storage.set('settings', 'private')
  assert.equal((await firstStorage.list()).length, 2)
  assert.deepEqual(await other.client.context.storage.list(), [
    { key: 'settings', value: 'private' },
  ])
})

test('storage initializes the write baseline lazily and rejects overlapping writes without retries', async (t) => {
  const host = createNessoStore(graph)
  host.store.applyOperations([
    {
      kind: 'plugin-storage.set',
      pluginId: 'nesso-plugin-example',
      documentId: host.store.getState().documentId,
      revision: 0,
      record: { key: 'settings', value: 'saved' },
    },
  ])
  const instance = fixture(false, undefined, [], ['storage'], host)
  t.after(instance.close)
  await instance.start()
  const { storage } = instance.client.context
  assert.equal(await storage.set('settings', 'first'), true)
  const results = await Promise.allSettled([
    storage.set('settings', 'second'),
    storage.delete('settings'),
  ])
  assert.deepEqual(results[0], { status: 'fulfilled', value: true })
  assert.equal(results[1].status, 'rejected')
  assert.ok(results[1].reason instanceof PluginError)
  assert.equal(results[1].reason.code, 'stale-state')
  assert.equal(await storage.delete('settings'), true)
  assert.deepEqual(await storage.list(), [])
})

test('raw storage identity injection and internal store mutations are rejected without effects', async (t) => {
  for (const [method, params] of [
    ['storage.list', { pluginId: 'nesso-plugin-other' }],
    ['storage.set', { documentId: 'urn:other', revision: 0, key: 'x', value: 0 }],
    [
      'document.applyOperations',
      {
        revision: 0,
        operations: [
          {
            kind: 'plugin-storage.set',
            pluginId: 'nesso-plugin-other',
            documentId: 'urn:other',
            revision: 0,
            record: { key: 'x', value: 0 },
          },
        ],
      },
    ],
    ['storage.set', { revision: 0, key: 'bad', value: undefined }],
  ]) {
    const instance = fixture(false, undefined, [], ['storage'])
    t.after(instance.close)
    await instance.start()
    const before = instance.host.store.getState()
    instance.channel.port2.postMessage({
      type: 'request',
      id: 1000,
      contextId: base.contextId,
      method,
      params,
    })
    await assert.rejects(instance.client.context.storage.list(), { code: 'closed' })
    assert.equal(instance.failures[0].code, 'invalid-input')
    assert.equal(instance.host.store.getState(), before)
  }
})

test('storage requests cannot publish after channel revocation or document replacement', async (t) => {
  const instance = fixture(false, undefined, [], ['storage'])
  t.after(instance.close)
  await instance.start()
  const before = instance.host.store.getState()
  const pending = instance.client.context.storage.set('late', 1)
  const rejected = assert.rejects(pending, { code: 'closed' })
  instance.runtime.close()
  await rejected
  assert.equal(instance.host.store.getState(), before)
  const reset = fixture(false, undefined, [], ['storage'])
  t.after(reset.close)
  await reset.start()
  await reset.client.context.storage.set('saved', 1)
  reset.host.store.resetGraph()
  await assert.rejects(reset.client.context.storage.set('late', 2), { code: 'closed' })
  assert.deepEqual(reset.host.store.getState().pluginStorage, [])
})
