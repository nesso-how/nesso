import assert from 'node:assert/strict'
import test from 'node:test'
import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { connectNotesLinks } from './links.ts'

test('notes link IPC validates the sender and destination before opening a canonical HTTPS URL', async (context) => {
  let handler!: Parameters<IpcMain['handle']>[1]
  let channel = ''
  let trusted = true
  let failed = false
  const opened: string[] = []
  context.mock.method(console, 'error', () => {})
  connectNotesLinks(
    {
      handle: (name, listener) => {
        channel = name
        handler = listener
      },
    },
    () => trusted,
    async (url) => {
      if (failed) throw new Error('Browser unavailable')
      opened.push(url)
    },
  )
  assert.equal(channel, 'notes-link:open')
  const event = {} as IpcMainInvokeEvent
  trusted = false
  assert.equal(await handler(event, 'https://example.com'), false)
  trusted = true
  for (const input of [null, 'javascript:alert(1)'])
    assert.equal(await handler(event, input), false)
  assert.deepEqual(opened, [])
  assert.equal(await handler(event, 'https://EXAMPLE.com:443/a?b=c#d'), true)
  assert.deepEqual(opened, ['https://example.com/a?b=c#d'])
  failed = true
  assert.equal(await handler(event, 'https://example.com'), false)
})
