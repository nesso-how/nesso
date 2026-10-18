import assert from 'node:assert/strict'
import test from 'node:test'
import { createTranslator } from '@nesso/i18n'
import en from '../i18n/en.json' with { type: 'json' }
import { createNotifications } from '../notifications/create.ts'
import { createPluginFiles } from './files.ts'

const translate = createTranslator(en)

test('file gestures run once, cancellation returns no file and synchronous adapter failures clear the UI', async () => {
  const notifications = createNotifications()
  let calls = 0
  const files = createPluginFiles({
    open: () => { if (++calls > 1) throw new Error('Unavailable'); return Promise.resolve({ name: 'file.json', mediaType: 'application/json', text: '{}' }) },
    save: async () => ({ saved: true }), cancel: () => {},
  }, notifications.api, new AbortController().signal, () => translate('en'))
  const result = files.open({ extensions: ['json'], mimeTypes: [] })
  assert.equal(calls, 0)
  const prompt = notifications.getSnapshot()[0]
  assert.ok(prompt.tone === 'confirmation')
  prompt.action.onClick()
  prompt.action.onClick()
  assert.equal((await result)?.name, 'file.json')
  assert.equal(calls, 1)
  const cancelled = files.open({ extensions: ['json'], mimeTypes: [] })
  const next = notifications.getSnapshot()[0]
  assert.ok(next.tone === 'confirmation')
  next.cancelAction.onClick()
  assert.equal(await cancelled, null)
  const failed = files.open({ extensions: ['json'], mimeTypes: [] })
  const failurePrompt = notifications.getSnapshot()[0]
  assert.ok(failurePrompt.tone === 'confirmation')
  failurePrompt.action.onClick()
  await assert.rejects(failed, { code: 'unavailable' })
  assert.equal(notifications.getSnapshot().length, 0)
})

test('cancellation and revocation cancel pending desktop requests and ignore late results', async () => {
  const notifications = createNotifications()
  const controller = new AbortController()
  const cancelled: string[] = []
  let finish: (value: { saved: boolean }) => void = () => {}
  const files = createPluginFiles({ open: async () => null, save: () => new Promise((resolve) => { finish = resolve }), cancel: (id) => cancelled.push(id) }, notifications.api, controller.signal, () => translate('en'))
  const result = files.save({ name: 'file.json', mediaType: 'application/json', text: '{}' })
  const prompt = notifications.getSnapshot()[0]
  assert.ok(prompt.tone === 'confirmation')
  prompt.action.onClick()
  prompt.cancelAction.onClick()
  assert.deepEqual(await result, { saved: false })
  prompt.cancelAction.onClick()
  assert.equal(cancelled.length, 1)
  finish({ saved: true })
  const revoked = files.save({ name: 'file.json', mediaType: 'application/json', text: '{}' })
  const next = notifications.getSnapshot()[0]
  assert.ok(next.tone === 'confirmation')
  next.action.onClick()
  controller.abort()
  await assert.rejects(revoked, { code: 'closed' })
  assert.equal(cancelled.length, 2)
  assert.equal(notifications.getSnapshot().length, 0)
  finish({ saved: true })
})

test('browser saves await picker and close, propagate failure, and cancel without late writes', async (t) => {
  const notifications = createNotifications()
  const controller = new AbortController()
  const files = createPluginFiles(undefined, notifications.api, controller.signal, () => translate('en'))
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
  const accept = () => {
    const prompt = notifications.getSnapshot()[0]
    assert.ok(prompt.tone === 'confirmation')
    prompt.action.onClick()
    return prompt
  }
  const saved = files.save(options)
  assert.equal(picker.mock.callCount(), 0)
  accept()
  await closeStarted
  assert.deepEqual(picker.mock.calls[0].arguments[0], { suggestedName: options.name })
  assert.equal(writable.close.mock.callCount(), 1)
  assert.equal(notifications.getSnapshot().length, 1)
  assert.deepEqual(writable.write.mock.calls[0].arguments, [options.text])
  finish()
  assert.deepEqual(await saved, { saved: true })
  picker.mock.mockImplementationOnce(async () => { throw new DOMException('Cancelled', 'AbortError') })
  const cancelled = files.save(options)
  accept()
  assert.deepEqual(await cancelled, { saved: false })
  assert.equal(handle.createWritable.mock.callCount(), 1)
  handle.createWritable.mock.mockImplementationOnce(async () => { throw new Error('Write failed') })
  const failed = files.save(options)
  accept()
  await assert.rejects(failed, { code: 'unavailable' })
  let select: (value: typeof handle) => void = () => {}
  picker.mock.mockImplementationOnce(() => new Promise((resolve) => { select = resolve }))
  const revoked = files.save(options)
  accept()
  controller.abort()
  await assert.rejects(revoked, { code: 'closed' })
  select(handle)
  await Promise.resolve()
  assert.equal(handle.createWritable.mock.callCount(), 2)
  assert.equal(notifications.getSnapshot().length, 0)
})
