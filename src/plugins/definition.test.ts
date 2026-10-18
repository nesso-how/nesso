import assert from 'node:assert/strict'
import test from 'node:test'
import { createPluginClient, themeTokens, type BaseState, type Definition, type PluginError } from '@nesso/plugin/runtime'
import { connectDefinitionChannel } from './definition.ts'

const state: BaseState = { revision: 0, contextId: 'definition', locale: 'en', theme: Object.fromEntries(themeTokens.map((token) => [token, ''])), conceptPlacementOffset: { x: 160, y: 100 } }
const definition = { id: 'example', relationTypes: [{ id: 'urn:nesso:related', label: 'Related' }], defaultTypeId: 'urn:nesso:related' }

test('definition channels expose only base state, deny effects and revoke immediately after a validated contribution', async (t) => {
  const channel = new MessageChannel()
  const received: Definition[] = []
  const failures: PluginError[] = []
  const runtime = connectDefinitionChannel(channel.port1, { kind: 'vocab' }, state, (value) => received.push(value), (error) => failures.push(error))
  const client = createPluginClient(channel.port2, state)
  t.after(() => { runtime.close(); client.close() })
  assert.deepEqual(Object.keys(client.context.store.getState()).sort(), ['conceptPlacementOffset', 'contextId', 'locale', 'revision', 'theme'])
  await client.context.store.refresh()
  assert.equal('clipboard' in client.context, false)
  await assert.rejects(client.context.files.open({ extensions: ['json'], mimeTypes: [] }), { code: 'denied' })
  await assert.rejects(client.context.notifications.notify({ tone: 'info', title: { en: 'Forbidden' } }), { code: 'denied' })
  await assert.rejects(client.context.store.applyOperations([{ kind: 'concept.add', id: 'urn:nesso:forbidden' }]), { code: 'denied' })
  channel.port2.postMessage({ type: 'contribution', value: definition })
  await assert.rejects(client.context.store.refresh(), { code: 'closed' })
  assert.deepEqual(received, [definition])
  assert.deepEqual(failures, [])
})

test('invalid or impersonating definitions close without registration', async (t) => {
  for (const value of [{ ...definition, id: 'another' }, { ...definition, defaultTypeId: 'urn:nesso:missing' }]) {
    const channel = new MessageChannel()
    const received: Definition[] = []
    const runtime = connectDefinitionChannel(channel.port1, { kind: 'vocab', id: 'example' }, state, (value) => received.push(value), () => {})
    const client = createPluginClient(channel.port2, state)
    t.after(() => { runtime.close(); client.close() })
    channel.port2.postMessage({ type: 'contribution', value })
    await assert.rejects(client.context.store.refresh(), { code: 'closed' })
    assert.deepEqual(received, [])
  }
})
