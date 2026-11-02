import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import type { PersistenceBridge } from '../shared/persistence.ts'
import type { PluginBridge } from '../shared/plugins.ts'

const preload = stripTypeScriptTypes(
  readFileSync(new URL('./preload.cts', import.meta.url), 'utf8'),
)

test('only runtime subscriptions advertise readiness and observer cleanup never disconnects them', () => {
  let bridge!: PluginBridge
  const sent: string[] = []
  const ipcRenderer = Object.assign(new EventEmitter(), {
    send: (channel: string) => sent.push(channel),
  })
  runInNewContext(preload, {
    require: () => ({
      ipcRenderer,
      contextBridge: {
        exposeInMainWorld: (name: string, value: PluginBridge) => {
          if (name === 'nessoPlugins') bridge = value
        },
      },
    }),
  })
  let received = 0
  const approval = bridge.subscribe(() => {})
  assert.deepEqual(sent, [])
  const runtime = bridge.subscribe(() => received++, true)
  const secondRuntime = bridge.subscribe(() => {}, true)
  const settings = bridge.subscribe(() => received++)
  assert.deepEqual(sent, ['plugins:ready'])
  settings()
  settings()
  assert.deepEqual(sent, ['plugins:ready'])
  ipcRenderer.emit('plugins:event', {}, { type: 'cancel', id: 'attempt' })
  assert.equal(received, 1)
  runtime()
  assert.deepEqual(sent, ['plugins:ready'])
  secondRuntime()
  assert.deepEqual(sent, ['plugins:ready', 'plugins:disconnect'])
  approval()
  assert.deepEqual(sent, ['plugins:ready', 'plugins:disconnect'])
})

test('close preparation saves first, asks the host for consent only on failure and reports the explicit decision', async () => {
  for (const [saved, approved] of [
    [true, false],
    [false, false],
    [false, true],
  ]) {
    const exposed = new Map<string, unknown>()
    const sent: string[] = []
    let complete!: (result: boolean) => void
    const result = new Promise<boolean>((resolve) => {
      complete = resolve
    })
    const ipcRenderer = Object.assign(new EventEmitter(), {
      send: (channel: string, value: boolean) => {
        sent.push(channel)
        if (channel === 'storage:closed') complete(value)
      },
    })
    runInNewContext(preload, {
      require: () => ({
        ipcRenderer,
        contextBridge: {
          exposeInMainWorld: (name: string, bridge: unknown) => {
            exposed.set(name, bridge)
          },
        },
      }),
    })
    const bridge = exposed.get('nessoPersistence') as PersistenceBridge
    const stop = bridge.beforeClose(
      async () => saved,
      async () => approved,
    )
    ipcRenderer.emit('storage:prepare')
    assert.equal(await result, saved || approved)
    assert.deepEqual(
      sent,
      saved
        ? ['storage:ready', 'storage:closed']
        : ['storage:ready', 'storage:confirming', 'storage:closed'],
    )
    stop()
    assert.equal(ipcRenderer.listenerCount('storage:prepare'), 0)
  }
})

test('each renderer pins its storage generation so a restored document cannot be overwritten by stale autosave', async () => {
  let generation = 1
  const calls: { channel: string; args: unknown[] }[] = []
  const start = () => {
    let bridge!: PersistenceBridge
    const ipcRenderer = Object.assign(new EventEmitter(), {
      invoke: async (channel: string, ...args: unknown[]) => {
        calls.push({ channel, args })
        return channel === 'storage:session' ? generation : { value: null }
      },
    })
    runInNewContext(preload, {
      require: () => ({
        ipcRenderer,
        contextBridge: {
          exposeInMainWorld: (name: string, value: PersistenceBridge) => {
            if (name === 'nessoPersistence') bridge = value
          },
        },
      }),
    })
    return bridge
  }
  const old = start()
  await Promise.all([old.read('document'), old.read('preferences')])
  generation++
  await old.write('document', 'stale state')
  await old.backup()
  const fresh = start()
  await fresh.read('document')
  assert.equal(calls.filter(({ channel }) => channel === 'storage:session').length, 2)
  assert.deepEqual(calls.find(({ channel }) => channel === 'storage:write')?.args, [
    'document',
    'stale state',
    1,
  ])
  assert.deepEqual(calls.at(-1), { channel: 'storage:read', args: ['document', 2] })
  assert.deepEqual(calls.find(({ channel }) => channel === 'storage:backup')?.args, [1])
})
