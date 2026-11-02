import assert from 'node:assert/strict'
import test from 'node:test'
import { badgeLimits, type ActionBadgeResult, type PluginError } from '@nesso-how/plugin/runtime'
import { connectBadgeChannel } from './badge-execution.ts'

const descriptors = [{ id: 'count', label: { en: 'Count' }, badge: true as const }]
const input = {
  viewId: null,
  viewGraph: { concepts: [], relations: [], relationTypes: [] },
  records: [],
  now: 0,
}

function fixture() {
  const { port1, port2 } = new MessageChannel()
  const failure = Promise.withResolvers<PluginError>()
  const result = Promise.withResolvers<ActionBadgeResult>()
  const channel = connectBadgeChannel(port1, descriptors, 'count', input, {
    ready: () => {},
    complete: result.resolve,
    failed: failure.resolve,
  })
  return {
    port: port2,
    failure: failure.promise,
    result: result.promise,
    start: () =>
      new Promise<void>((resolve) => {
        port2.onmessage = ({ data }) => {
          assert.equal(data.type, 'badge')
          assert.deepEqual(data.input, input)
          resolve()
        }
        port2.postMessage({ type: 'contribution', value: descriptors })
      }),
    close: () => {
      channel.close()
      port2.close()
    },
  }
}

test('badge channels return validated results and reject every host API request', async (t) => {
  const valid = fixture()
  t.after(valid.close)
  await valid.start()
  valid.port.postMessage({ type: 'badge-result', value: { value: 3, refreshAt: 1000 } })
  assert.deepEqual(await valid.result, { value: 3, refreshAt: 1000 })
  const denied = fixture()
  t.after(denied.close)
  await denied.start()
  denied.port.postMessage({
    type: 'request',
    id: 1,
    contextId: 'forged',
    method: 'storage.set',
    params: { key: 'progress', value: 1, revision: 0 },
  })
  assert.equal((await denied.failure).code, 'denied')
})

test('malformed badges, changed descriptors and stalled providers fail closed', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  for (const value of [
    { value: -1 },
    { value: badgeLimits.value + 1 },
    { value: 1, refreshAt: 'soon' },
  ]) {
    const f = fixture()
    t.after(f.close)
    await f.start()
    f.port.postMessage({ type: 'badge-result', value })
    assert.equal((await f.failure).code, 'invalid-input')
  }
  const changed = fixture()
  t.after(changed.close)
  changed.port.postMessage({
    type: 'contribution',
    value: [{ ...descriptors[0], badge: undefined }],
  })
  assert.equal((await changed.failure).code, 'denied')
  const stalled = fixture()
  t.after(stalled.close)
  await stalled.start()
  t.mock.timers.tick(badgeLimits.execution)
  assert.equal((await stalled.failure).code, 'timeout')
})
