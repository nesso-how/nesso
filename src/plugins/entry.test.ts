import assert from 'node:assert/strict'
import test from 'node:test'
import { PluginError } from '@nesso-how/plugin/runtime'
import { createPluginEntry } from './entry.ts'

test('bundled entries reuse prepared code only within their package instance', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('export const a = 1'))
  const signal = new AbortController().signal
  const first = createPluginEntry('preinstalled/example/index.js')
  const source = await first(signal)
  assert.equal(source, `data:text/javascript;base64,${btoa('export const a = 1')}`)
  assert.equal(await first(signal), source)
  assert.equal(fetch.mock.callCount(), 1)
  await createPluginEntry('preinstalled/example/index.js')(signal)
  assert.equal(fetch.mock.callCount(), 2)
})

test('received entries retain the exact bytes captured for that package', async () => {
  const bytes = new TextEncoder().encode(`export const text = '${'è世界'.repeat(20000)}'`)
  const expected = Buffer.from(bytes).toString('base64')
  const first = createPluginEntry(bytes)
  bytes.fill(0)
  const replacement = createPluginEntry(bytes)
  const signal = new AbortController().signal
  assert.equal(await first(signal), `data:text/javascript;base64,${expected}`)
  assert.equal(await first(signal), `data:text/javascript;base64,${expected}`)
  assert.notEqual(await replacement(signal), await first(signal))
})

test('failed and cancelled loads do not cache failures or revive cancelled invocations', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 404 }))
  const entry = createPluginEntry('preinstalled/example/index.js')
  const controller = new AbortController()
  await assert.rejects(entry(controller.signal), { code: 'failed' })
  fetch.mock.mockImplementation(async () => {
    controller.abort()
    return new Response('export const a = 1')
  })
  await assert.rejects(entry(controller.signal), { name: 'AbortError' })
  fetch.mock.mockImplementation(async () => new Response('export const a = 2'))
  const source = await entry(new AbortController().signal)
  assert.equal(source, `data:text/javascript;base64,${btoa('export const a = 2')}`)
  await assert.rejects(entry(controller.signal), { name: 'AbortError' })
  assert.equal(fetch.mock.callCount(), 3)
})

test('plugin entries still reject oversized assets before preparing them', async () => {
  const entry = createPluginEntry(new Uint8Array(16 * 1024 * 1024 + 1))
  await assert.rejects(
    entry(new AbortController().signal),
    (error: unknown) => error instanceof PluginError && error.code === 'invalid-input',
  )
})
