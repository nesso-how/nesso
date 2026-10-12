import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import type { ipcMain, IpcMainEvent, WebContents } from 'electron'
import { prepareDataTransfer } from './data-transfer.ts'

function fixture() {
  const bus = new EventEmitter()
  const sent: { id: number; request: string }[] = []
  const windows = [1, 2].map((id) => Object.assign(new EventEmitter(), {
    id,
    send: (_channel: string, request: string) => { sent.push({ id, request }) },
  }))
  const reply = (id: number, request: string, saved: unknown, trusted = true) => {
    bus.emit('data-location:prepared', { sender: { id }, trusted }, request, saved)
  }
  const prepare = (timeout = 1000) => prepareDataTransfer(
    windows as unknown as WebContents[], bus as typeof ipcMain,
    (event) => (event as IpcMainEvent & { trusted: boolean }).trusted, timeout,
  )
  const clean = () => {
    assert.equal(bus.listenerCount('data-location:prepared'), 0)
    for (const window of windows) {
      assert.equal(window.listenerCount('destroyed'), 0)
      assert.equal(window.listenerCount('did-start-navigation'), 0)
    }
  }
  return { windows, sent, reply, prepare, clean }
}

test('transfer preparation requires successful trusted acknowledgements from every window', async () => {
  const { sent, reply, prepare, clean } = fixture()
  let finished = false
  const pending = prepare().then(() => { finished = true })
  const request = sent[0].request
  assert.equal(sent[1].request, request)
  reply(1, request, true, false)
  reply(2, 'stale request', true)
  reply(3, request, true)
  await Promise.resolve()
  assert.equal(finished, false)
  reply(1, request, true)
  reply(1, request, false)
  await Promise.resolve()
  assert.equal(finished, false)
  reply(2, request, true)
  await pending
  clean()
})

test('failed saves, window destruction, navigation and missing acknowledgements prevent a transfer', async () => {
  for (const failure of ['save', 'destroyed', 'did-start-navigation', 'timeout']) {
    const { sent, windows, reply, prepare, clean } = fixture()
    const pending = prepare(failure === 'timeout' ? 1 : 1000)
    if (failure === 'save') reply(1, sent[0].request, false)
    else if (failure !== 'timeout') windows[0].emit(failure)
    await assert.rejects(pending, /storageSaveFailure/)
    clean()
  }
})
