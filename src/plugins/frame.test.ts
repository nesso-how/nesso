import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { PluginError, runtimeLimits } from '@nesso-how/plugin/runtime'
import { createPluginFrame } from './frame.ts'

function fixture(t: TestContext) {
  const entry = Promise.withResolvers<string>()
  const globals = { window: new EventTarget(), document: { baseURI: 'https://nesso.test/app/' } }
  const descriptors = Object.keys(globals).map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  )
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  const post = t.mock.fn((_data: object, _origin: string, ports: MessagePort[] = []) => {
    for (const port of ports) port.close()
  })
  const element = {
    src: '',
    title: '@nesso-how/notes',
    onload: null as (() => void) | null,
    contentWindow: { postMessage: post },
  }
  const close = t.mock.fn()
  const connect = t.mock.fn((port: MessagePort, _failed: (error: PluginError) => void) => ({
    close: () => {
      close()
      port.close()
    },
  }))
  const failed = t.mock.fn<(error: PluginError) => void>()
  const discarded = t.mock.fn()
  let signal: AbortSignal
  const container = createPluginFrame(
    element as unknown as HTMLIFrameElement,
    (value) => {
      signal = value
      return entry.promise
    },
    true,
    discarded,
  )
  const message = (
    type: string,
    guard = new URL(element.src).hash.slice(1),
    source = element.contentWindow,
  ) => {
    const event = new Event('message')
    Object.assign(event, { source, data: { type, guard } })
    window.dispatchEvent(event)
  }
  const load = () => container.load(connect, failed)
  t.after(() => {
    container.close()
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  })
  return {
    entry,
    element,
    post,
    connect,
    close,
    failed,
    container,
    message,
    load,
    discarded,
    signal: () => signal,
  }
}

test('preloading waits for runner, entry and authenticated module readiness without opening a channel', async (t) => {
  for (const first of ['runner', 'entry'])
    await t.test(first, async (t) => {
      const f = fixture(t)
      if (first === 'runner') f.element.onload!()
      else f.entry.resolve('data:text/javascript,export{}')
      await new Promise(setImmediate)
      assert.equal(f.post.mock.callCount(), 0)
      if (first === 'runner') f.entry.resolve('data:text/javascript,export{}')
      else f.element.onload!()
      await new Promise(setImmediate)
      assert.equal(f.post.mock.callCount(), 1)
      assert.equal(f.post.mock.calls[0].arguments[2], undefined)
      let ready = false
      void f.container.ready.then(() => {
        ready = true
      })
      f.message('plugin-ready', 'wrong')
      f.message('plugin-ready', undefined, { postMessage: f.post })
      await new Promise(setImmediate)
      assert.equal(ready, false)
      f.message('plugin-ready')
      await f.container.ready
      assert.equal(f.connect.mock.callCount(), 0)
      f.load()
      await new Promise(setImmediate)
      assert.equal(f.connect.mock.callCount(), 1)
    })
})

test('sessions revoke channels but retain their instance; stale callbacks cannot affect replacements', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const f = fixture(t)
  f.element.onload!()
  f.entry.resolve('data:text/javascript,export{}')
  await new Promise(setImmediate)
  f.message('plugin-ready')
  const first = f.load()
  await new Promise(setImmediate)
  const [, staleFailed] = f.connect.mock.calls[0].arguments
  const shell = f.element.src
  first.close()
  assert.equal(f.close.mock.callCount(), 1)
  assert.equal(f.signal().aborted, false)
  f.load()
  await new Promise(setImmediate)
  assert.equal(f.element.src, shell)
  assert.equal(f.connect.mock.callCount(), 2)
  assert.deepEqual(
    f.post.mock.calls.map(({ arguments: [data] }) => (data as { entry?: string }).entry),
    ['data:text/javascript,export{}', undefined, undefined],
  )
  staleFailed(new PluginError('closed', []))
  t.mock.timers.tick(runtimeLimits.initialization)
  assert.equal(f.failed.mock.callCount(), 0)
  f.connect.mock.calls[1].arguments[1](new PluginError('timeout', []))
  assert.deepEqual(
    f.failed.mock.calls.map(({ arguments: [error] }) => error.code),
    ['timeout'],
  )
  assert.equal(f.signal().aborted, true)
  assert.equal(f.discarded.mock.callCount(), 1)
})

test('failed and cancelled preloads cannot connect late entries', async (t) => {
  for (const reason of ['close', 'timeout', 'navigation'])
    await t.test(reason, async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout'] })
      const f = fixture(t)
      f.load()
      const rejected = assert.rejects(f.container.ready, PluginError)
      f.element.onload!()
      if (reason === 'close') f.container.close()
      else if (reason === 'timeout') t.mock.timers.tick(runtimeLimits.initialization)
      else f.element.onload!()
      f.entry.resolve('data:text/javascript,export{}')
      await rejected
      await new Promise(setImmediate)
      assert.equal(f.connect.mock.callCount(), 0)
      assert.equal(f.element.src, 'about:blank')
      assert.equal(f.signal().aborted, true)
    })
})

test('loading timeouts identify the plugin and unfinished initialization stages', async (t) => {
  for (const stage of ['runner', 'entry', 'modules'])
    await t.test(stage, async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout'] })
      const f = fixture(t)
      if (stage !== 'runner') f.element.onload!()
      if (stage !== 'entry') f.entry.resolve('data:text/javascript,export{}')
      await new Promise(setImmediate)
      const rejected = assert.rejects(f.container.ready, (error: unknown) => {
        assert.ok(error instanceof PluginError)
        assert.equal(error.code, 'timeout')
        assert.match(error.message, /@nesso-how\/notes/)
        assert.ok(
          error.message.includes(
            `runner=${stage !== 'runner'}, entry=${stage !== 'entry'}, panel=true`,
          ),
        )
        return true
      })
      t.mock.timers.tick(runtimeLimits.initialization)
      await rejected
      assert.equal(f.discarded.mock.callCount(), 1)
    })
})
