import assert from 'node:assert/strict'
import test from 'node:test'
import { PluginError, type PluginStorage, type PluginStorageRecord } from '@nesso-how/plugin'
import { createNotes } from './notes.ts'

function fixture(initial: readonly PluginStorageRecord[] = []) {
  const records = new Map(
    initial.map((record) => [
      JSON.stringify([record.scope ?? null, record.key]),
      structuredClone(record),
    ]),
  )
  const writes: PluginStorageRecord[] = []
  let fail = false
  let pending: Promise<void> | undefined
  let release: (() => void) | undefined
  const storage: PluginStorage = {
    list: async () => [...records.values()],
    set: async (key, value, scope) => {
      const record = scope === undefined ? { key, value } : { key, value, scope }
      writes.push(record)
      await pending
      if (fail) throw new PluginError('stale-state', [])
      records.set(JSON.stringify([scope ?? null, key]), structuredClone(record))
      return true
    },
    delete: async (key, scope) => records.delete(JSON.stringify([scope ?? null, key])),
  }
  return {
    storage,
    records,
    writes,
    fail: () => {
      fail = true
    },
    hold: () => {
      pending = new Promise<void>((resolve) => {
        release = resolve
      })
    },
    release: () => {
      pending = undefined
      release?.()
    },
  }
}

const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

test('notes use document scope for Overview and isolated view scopes for saved views', async () => {
  const f = fixture()
  const overview = await createNotes(f.storage, null)
  const first = await createNotes(f.storage, 'urn:first')
  const second = await createNotes(f.storage, 'urn:second')
  overview.setText('Overview')
  first.setText('**Project**\n- Idea')
  second.setText('Another project')
  await settle()
  assert.equal((await createNotes(f.storage, null)).getSnapshot().text, 'Overview')
  assert.equal(
    (await createNotes(f.storage, 'urn:first')).getSnapshot().text,
    '**Project**\n- Idea',
  )
  assert.equal((await createNotes(f.storage, 'urn:second')).getSnapshot().text, 'Another project')
  first.setText('')
  await settle()
  assert.equal((await createNotes(f.storage, 'urn:first')).getSnapshot().text, '')
})

test('edits publish immediately, serialize overlapping saves and keep the latest text', async () => {
  const f = fixture()
  const notes = await createNotes(f.storage, 'urn:view')
  f.hold()
  notes.setText('A')
  notes.setText('AB')
  notes.setText('ABC')
  assert.equal(notes.getSnapshot().text, 'ABC')
  assert.equal(f.writes.length, 1)
  f.release()
  await settle()
  assert.equal(f.writes.length, 2)
  assert.deepEqual(f.writes[1], {
    key: 'notes',
    scope: { kind: 'view', id: 'urn:view' },
    value: { version: 1, text: 'ABC' },
  })
  assert.equal((await createNotes(f.storage, 'urn:view')).getSnapshot().text, 'ABC')
})

test('failed saves retain the latest draft and never retry or refresh the storage baseline', async () => {
  const f = fixture()
  const notes = await createNotes(f.storage, 'urn:view')
  f.hold()
  f.fail()
  notes.setText('First')
  notes.setText('Latest draft')
  f.release()
  await settle()
  assert.deepEqual(notes.getSnapshot(), { text: 'Latest draft', failed: true })
  notes.setText('Do not overwrite')
  await settle()
  assert.deepEqual(notes.getSnapshot(), { text: 'Latest draft', failed: true })
  assert.equal(f.writes.length, 1)
  assert.equal(f.records.size, 0)
})

test('invalid and unknown-version notes remain untouched; unrelated scopes are ignored', async () => {
  for (const value of [
    { version: 2, text: 'Future' },
    { version: 1, text: 1 },
  ]) {
    const f = fixture([{ key: 'notes', value }])
    await assert.rejects(createNotes(f.storage, null), PluginError)
    assert.equal(f.writes.length, 0)
    assert.deepEqual([...f.records.values()][0].value, value)
  }
  const f = fixture([{ key: 'notes', scope: { kind: 'concept', id: 'urn:view' }, value: null }])
  assert.equal((await createNotes(f.storage, 'urn:view')).getSnapshot().text, '')
})
