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
  const post = t.mock.fn(
    (
      _message: { type: string; guard: string; token: string; entry?: string },
      _origin: string,
      ports?: MessagePort[],
    ) => {
      for (const port of ports ?? []) port.close()
    },
  )
  const element = {
    src: '',
    onload: null as (() => void) | null,
    contentWindow: { postMessage: post },
  }
  const close = t.mock.fn()
  const connect = t.mock.fn(
    (port: MessagePort, _ready: () => void, _failed: (error: PluginError) => void) => ({
      close: () => {
        close()
        port.close()
      },
    }),
  )
  const failed = t.mock.fn<(error: PluginError) => void>()
  const container = createPluginFrame(element as unknown as HTMLIFrameElement, true)
  const signals: AbortSignal[] = []
  const load = (promise = entry.promise) =>
    container.load(
      (signal) => {
        signals.push(signal!)
        return promise
      },
      connect,
      failed,
    )
  const runtime = load()
  const message = (data: object, source = element.contentWindow) => {
    const event = new Event('message')
    Object.assign(event, { source, data })
    window.dispatchEvent(event)
  }
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
    runtime,
    load,
    signals,
    message,
  }
}

test('runner and entry load concurrently and neither can connect alone', async (t) => {
  for (const first of ['runner', 'entry']) {
    await t.test(first, async (t) => {
      const f = fixture(t)
      assert.equal(new URL(f.element.src).pathname, '/app/plugin-runner/panel.html')
      if (first === 'runner') f.element.onload!()
      else f.entry.resolve('data:text/javascript,export{}')
      await new Promise(setImmediate)
      assert.equal(f.connect.mock.callCount(), 0)
      if (first === 'runner') f.entry.resolve('data:text/javascript,export{}')
      else f.element.onload!()
      await new Promise(setImmediate)
      assert.equal(f.connect.mock.callCount(), 1)
      assert.equal(f.post.mock.calls[0].arguments[0].entry, 'data:text/javascript,export{}')
    })
  }
})

test('cancelled and timed-out loads cannot execute stale entries after a retry', async (t) => {
  for (const reason of ['close', 'timeout']) {
    await t.test(reason, async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout'] })
      const f = fixture(t)
      if (reason === 'close') f.runtime.close()
      else t.mock.timers.tick(runtimeLimits.initialization)
      assert.equal(f.signals[0].aborted, true)
      assert.deepEqual(
        f.failed.mock.calls.map(({ arguments: [error] }) => error.code),
        reason === 'timeout' ? ['timeout'] : [],
      )
      f.load(Promise.resolve('data:text/javascript,export const current=true'))
      f.entry.resolve('data:text/javascript,export const stale=true')
      await new Promise(setImmediate)
      f.element.onload!()
      assert.equal(f.connect.mock.callCount(), 1)
      assert.equal(
        f.post.mock.calls[0].arguments[0].entry,
        'data:text/javascript,export const current=true',
      )
    })
  }
})

test('replacement revokes the old channel and waits for an authenticated reset', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const f = fixture(t)
  f.element.onload!()
  f.entry.resolve('data:text/javascript,export{}')
  await new Promise(setImmediate)
  const initial = f.post.mock.calls[0].arguments[0]
  const shell = f.element.src
  const reset = t.mock.method(f.element.contentWindow, 'postMessage', () => {
    assert.equal(f.close.mock.callCount(), 1)
    assert.equal(f.signals[0].aborted, true)
  })
  f.load(Promise.resolve('data:text/javascript,export const next=true'))
  const acknowledgement = { ...reset.mock.calls[0].arguments[0], type: 'plugin-reset' }
  reset.mock.restore()
  assert.equal(acknowledgement.token, initial.token)
  await new Promise(setImmediate)
  for (const [data, source] of [
    [acknowledgement, { postMessage: f.post }],
    [{ ...acknowledgement, guard: 'wrong' }, f.element.contentWindow],
    [{ ...acknowledgement, token: 'stale' }, f.element.contentWindow],
  ] as const) {
    f.message(data, source)
    assert.equal(f.connect.mock.callCount(), 1)
  }
  f.message(acknowledgement)
  const replacement = f.post.mock.calls.at(-1)!.arguments[0]
  assert.equal(replacement.entry, 'data:text/javascript,export const next=true')
  assert.notEqual(replacement.token, initial.token)
  assert.equal(f.element.src, shell)
  f.connect.mock.calls[1].arguments[1]()
  f.connect.mock.calls[0].arguments[2](new PluginError('closed', []))
  f.message({ type: 'plugin-closed', token: initial.token })
  f.runtime.close()
  f.runtime.reconnect()
  t.mock.timers.tick(runtimeLimits.initialization)
  assert.equal(f.signals[1].aborted, false)
  assert.equal(f.failed.mock.callCount(), 0)
})

test('callbacks from a superseded connection cannot fail its replacement or cancel its deadline', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const f = fixture(t)
  f.element.onload!()
  f.entry.resolve('data:text/javascript,export{}')
  await new Promise(setImmediate)
  const [, staleReady, staleFailed] = f.connect.mock.calls[0].arguments
  f.runtime.reconnect()
  staleFailed(new PluginError('closed', []))
  assert.equal(f.failed.mock.callCount(), 0)
  staleReady()
  t.mock.timers.tick(runtimeLimits.initialization)
  assert.deepEqual(
    f.failed.mock.calls.map(({ arguments: [error] }) => error.code),
    ['timeout'],
  )
  assert.equal(f.signals[0].aborted, true)
})

test('an unacknowledged reset fails its replacement and releases the shell', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const f = fixture(t)
  f.element.onload!()
  f.entry.resolve('data:text/javascript,export{}')
  await new Promise(setImmediate)
  const shell = f.element.src
  f.load(Promise.resolve('data:text/javascript,export const next=true'))
  await new Promise(setImmediate)
  t.mock.timers.tick(runtimeLimits.initialization - 1)
  assert.equal(f.element.src, shell)
  assert.equal(f.failed.mock.callCount(), 0)
  t.mock.timers.tick(1)
  assert.deepEqual(
    f.failed.mock.calls.map(({ arguments: [error] }) => error.code),
    ['timeout'],
  )
  assert.equal(f.element.src, 'about:blank')
  f.load(Promise.resolve('data:text/javascript,export const retry=true'))
  await new Promise(setImmediate)
  assert.notEqual(f.element.src, shell)
  f.element.onload!()
  assert.equal(
    f.post.mock.calls.at(-1)!.arguments[0].entry,
    'data:text/javascript,export const retry=true',
  )
  assert.equal(f.connect.mock.callCount(), 2)
})
