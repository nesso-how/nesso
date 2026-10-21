import assert from 'node:assert/strict'
import test from 'node:test'
import { createPluginFiles } from './files.ts'

test('desktop files call the native bridge directly and forward abort as cancellation', async () => {
  let calls = 0
  const seen: string[] = []
  const files = createPluginFiles({
    open: (id) => { calls++; seen.push(id); return Promise.resolve({ name: 'file.json', mediaType: 'application/json', text: '{}' }) },
    save: async () => ({ saved: true }), cancel: (id) => { seen.push(`cancel:${id}`) },
  }, new AbortController().signal)
  const result = files.open({ extensions: ['json'], mimeTypes: [] })
  assert.equal(calls, 1)
  assert.equal((await result)?.name, 'file.json')
  assert.match(seen[0], /^[a-f0-9-]{36}$/)
  const controller = new AbortController()
  const cancelled: string[] = []
  let finish: (value: { saved: boolean }) => void = () => {}
  const abortable = createPluginFiles({ open: async () => null, save: () => new Promise((resolve) => { finish = resolve }), cancel: (id) => cancelled.push(id) }, controller.signal)
  const pending = abortable.save({ name: 'file.json', mediaType: 'application/json', text: '{}' })
  controller.abort()
  assert.equal(cancelled.length, 1)
  finish({ saved: false })
  assert.deepEqual(await pending, { saved: false })
  const aborted = createPluginFiles({ open: async () => null, save: async () => ({ saved: true }), cancel: () => {} }, controller.signal)
  await assert.rejects(aborted.save({ name: 'file.json', mediaType: 'application/json', text: '{}' }), { code: 'closed' })
  const failed = createPluginFiles({
    open: () => Promise.reject(new Error('Unavailable')),
    save: async () => ({ saved: true }), cancel: () => {},
  }, new AbortController().signal)
  await assert.rejects(failed.open({ extensions: ['json'], mimeTypes: [] }), { code: 'unavailable' })
})

test('browser file calls reject when the channel is already closed', async () => {
  const controller = new AbortController()
  controller.abort()
  const files = createPluginFiles(undefined, controller.signal)
  await assert.rejects(files.open({ extensions: ['json'], mimeTypes: [] }), { code: 'closed' })
  await assert.rejects(files.save({ name: 'file.json', mediaType: 'application/json', text: '{}' }), { code: 'closed' })
})

test('browser saves use the picker immediately and fall back to download without activation', async (t) => {
  const controller = new AbortController()
  const files = createPluginFiles(undefined, controller.signal)
  const options = { name: 'file.json', mediaType: 'application/json', text: '{}' }
  let finish: () => void = () => {}
  let closing: () => void = () => {}
  const closeStarted = new Promise<void>((resolve) => { closing = resolve })
  const writable = {
    write: t.mock.fn(async (_text: string) => {}),
    close: t.mock.fn(() => { closing(); return new Promise<void>((resolve) => { finish = resolve }) }),
    abort: t.mock.fn(async () => {}),
  }
  const handle = { createWritable: t.mock.fn(async () => writable) }
  const picker = t.mock.fn(async (_options: { suggestedName: string }) => handle)
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'showSaveFilePicker')
  Object.defineProperty(globalThis, 'showSaveFilePicker', { configurable: true, value: picker })
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'showSaveFilePicker', descriptor); else Reflect.deleteProperty(globalThis, 'showSaveFilePicker') })
  const saved = files.save(options)
  assert.equal(picker.mock.callCount(), 1)
  await closeStarted
  assert.deepEqual(picker.mock.calls[0].arguments[0], { suggestedName: options.name })
  assert.deepEqual(writable.write.mock.calls[0].arguments, [options.text])
  finish()
  assert.deepEqual(await saved, { saved: true })
  picker.mock.mockImplementationOnce(async () => { throw new DOMException('Cancelled', 'AbortError') })
  assert.deepEqual(await files.save(options), { saved: false })
  handle.createWritable.mock.mockImplementationOnce(async () => { throw new Error('Write failed') })
  await assert.rejects(files.save(options), { code: 'unavailable' })
  picker.mock.mockImplementationOnce(async () => { throw new DOMException('Denied', 'SecurityError') })
  const anchor = { click: t.mock.fn() }
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => anchor } })
  t.after(() => { if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor); else Reflect.deleteProperty(globalThis, 'document') })
  assert.deepEqual(await files.save(options), { saved: true })
  assert.equal(anchor.click.mock.callCount(), 1)
  let select: (value: typeof handle) => void = () => {}
  picker.mock.mockImplementationOnce(() => new Promise((resolve) => { select = resolve }))
  const revoked = files.save(options)
  controller.abort()
  await assert.rejects(revoked, { code: 'closed' })
  select(handle)
  await Promise.resolve()
  assert.equal(handle.createWritable.mock.callCount(), 2)
})
