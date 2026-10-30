import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PluginError, type ActionContext, type PluginStorageRecord } from '@nesso-how/plugin'
import { createReview } from './scheduler.ts'

function fixture() {
  let time = new Date('2026-10-30T12:00:00.000Z')
  const records = new Map<string, PluginStorageRecord>()
  const calls: PluginStorageRecord[] = []
  let fail = false
  let release: (() => void) | undefined
  const storage: ActionContext['storage'] = {
    list: async () => structuredClone([...records.values()]),
    set: async (key, value, conceptId) => {
      calls.push({ key, value, conceptId })
      if (release)
        await new Promise<void>((resolve) => {
          release = resolve
        })
      if (fail) throw new PluginError('stale-state', [{ path: 'storage', message: 'Conflict' }])
      records.set(conceptId!, structuredClone({ key, value, conceptId }))
      return true
    },
    delete: async (_key, id) => records.delete(id!),
  }
  return {
    records,
    calls,
    storage,
    now: () => time,
    advance: (ms: number) => {
      time = new Date(time.getTime() + ms)
    },
    fail: () => {
      fail = true
    },
    hold: () => {
      release = () => {}
    },
    release: () => {
      release?.()
      release = undefined
    },
  }
}

test('concepts are automatically due; empty or unrevealed sessions never write', async () => {
  const f = fixture()
  const review = await createReview(f.storage, f.now)
  review.start()
  assert.equal(review.getSnapshot().session, null)
  review.setScope(['urn:a', 'urn:b', 'urn:a'])
  assert.deepEqual(review.due(), ['urn:a', 'urn:b'])
  review.start()
  assert.deepEqual(review.getSnapshot().session?.ids, ['urn:a', 'urn:b'])
  await review.rate(3)
  assert.equal(f.calls.length, 0)
  review.finish()
  assert.deepEqual(review.getSnapshot().outcome, { reviewed: 0, complete: false })
})

test('each rating persists its preview and log, then completes the round', async () => {
  for (const grade of [1, 2, 3, 4] as const) {
    const f = fixture()
    const review = await createReview(f.storage, f.now)
    review.setScope(['urn:a'])
    const preview = review.preview('urn:a').find((item) => item.grade === grade)!
    review.start()
    review.reveal()
    await review.rate(grade)
    assert.equal(f.calls.length, 1)
    const result = review.getSnapshot().progress.get('urn:a')!
    assert.deepEqual(result.card, preview.card)
    assert.deepEqual(result.logs, [preview.revlog])
    assert.deepEqual(review.getSnapshot().outcome, { reviewed: 1, complete: true })
    assert.equal(review.getSnapshot().session, null)
    assert.deepEqual(review.due(), [])
    assert.equal(f.calls[0].conceptId, 'urn:a')
  }
})

test('progress restores across views and repeated reviews update one schedule', async () => {
  const f = fixture()
  const first = await createReview(f.storage, f.now)
  first.setScope(['urn:a', 'urn:b'])
  first.start()
  first.reveal()
  await first.rate(3)
  first.finish()
  assert.deepEqual(first.getSnapshot().outcome, { reviewed: 1, complete: false })
  const reopened = await createReview(f.storage, f.now)
  reopened.setScope(['urn:c', 'urn:a'])
  assert.deepEqual(reopened.due(), ['urn:c'])
  assert.deepEqual(reopened.getSnapshot().progress, first.getSnapshot().progress)
  const due = reopened.getSnapshot().progress.get('urn:a')!.card.dueAt
  assert.deepEqual(reopened.due(['urn:a'], new Date(due.getTime() - 1)), [])
  assert.deepEqual(reopened.due(['urn:a'], due), ['urn:a'])
  f.advance(20 * 60_000)
  reopened.setScope(['urn:a'])
  reopened.start()
  reopened.reveal()
  const preview = reopened.preview('urn:a').find((item) => item.grade === 4)!
  await reopened.rate(4)
  assert.deepEqual(reopened.getSnapshot().progress.get('urn:a')!.card, preview.card)
  assert.equal(reopened.getSnapshot().progress.get('urn:a')!.logs.length, 2)
  assert.equal(f.records.size, 1)
})

test('scope changes skip removed concepts and preserve progress without completion', async () => {
  const f = fixture()
  const review = await createReview(f.storage, f.now)
  review.setScope(['urn:a', 'urn:b', 'urn:c', 'urn:d'])
  review.start()
  review.reveal()
  await review.rate(2)
  review.setScope(['urn:a', 'urn:c', 'urn:d'])
  assert.deepEqual(review.getSnapshot().session, {
    ids: ['urn:a', 'urn:c', 'urn:d'],
    index: 1,
    revealed: false,
  })
  review.reveal()
  await review.rate(3)
  assert.equal(review.getSnapshot().session?.index, 2)
  review.setScope([])
  assert.equal(review.getSnapshot().session, null)
  assert.deepEqual(review.getSnapshot().outcome, { reviewed: 2, complete: false })
  review.setScope(['urn:a'])
  assert.deepEqual(review.due(), [])
  assert.equal(f.records.size, 2)
})

test('pending writes block duplicate ratings and finish, respecting scope changes', async () => {
  const f = fixture()
  const review = await createReview(f.storage, f.now)
  review.setScope(['urn:a', 'urn:b'])
  review.start()
  review.reveal()
  f.hold()
  const pending = review.rate(3)
  assert.equal(review.getSnapshot().busy, true)
  await review.rate(1)
  review.finish()
  assert.ok(review.getSnapshot().session)
  review.setScope([])
  f.release()
  await pending
  assert.equal(f.calls.length, 1)
  assert.equal(review.getSnapshot().session, null)
  assert.deepEqual(review.getSnapshot().outcome, { reviewed: 1, complete: false })
})

test('failed writes block progress and retries; invalid records remain untouched', async () => {
  const f = fixture()
  const review = await createReview(f.storage, f.now)
  review.setScope(['urn:a'])
  review.start()
  review.reveal()
  f.fail()
  await review.rate(3)
  assert.equal(review.getSnapshot().failed, true)
  assert.equal(review.getSnapshot().session?.index, 0)
  assert.equal(review.getSnapshot().progress.size, 0)
  const failed = review.getSnapshot()
  review.reveal()
  await review.rate(3)
  assert.equal(review.getSnapshot(), failed)
  assert.equal(f.calls.length, 1)
  const invalid: PluginStorageRecord['value'][] = [
    null,
    { model: 'FSRS-7' },
    { model: 'FSRS-6', card: { dueAt: 'invalid' }, logs: [] },
  ]
  for (const value of invalid) {
    f.records.set('urn:a', { key: 'progress', conceptId: 'urn:a', value })
    await assert.rejects(createReview(f.storage, f.now), PluginError)
    assert.deepEqual(f.records.get('urn:a')?.value, value)
  }
})
