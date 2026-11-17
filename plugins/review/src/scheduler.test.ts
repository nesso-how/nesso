import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PluginError, type ActionContext, type PluginStorageRecord } from '@nesso-how/plugin'
import { createReview, reviewBadge } from './scheduler.ts'

type Value = PluginStorageRecord['value']

function fixture() {
  let time = new Date('2026-10-30T12:00:00.000Z')
  const records = new Map<string, PluginStorageRecord>()
  const calls: PluginStorageRecord[] = []
  let fail = false
  let release: (() => void) | undefined
  const storage: ActionContext['storage'] = {
    list: async () => structuredClone([...records.values()]),
    set: async (key, value, scope) => {
      calls.push({ key, value, scope })
      if (release)
        await new Promise<void>((resolve) => {
          release = resolve
        })
      if (fail) throw new PluginError('stale-state', [{ path: 'storage', message: 'Conflict' }])
      records.set(scope!.id, structuredClone({ key, value, scope }))
      return true
    },
    delete: async (_key, scope) => {
      if (fail) throw new PluginError('stale-state', [{ path: 'storage', message: 'Conflict' }])
      return records.delete(scope!.id)
    },
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

test('badges count only target-view concepts and request the next change using shared progress', async () => {
  const f = fixture()
  const review = await createReview(f.storage, f.now)
  review.setScope(['urn:a'])
  review.start()
  review.reveal()
  await review.rate(3)
  const due = review.getSnapshot().progress.get('urn:a')!.card.dueAt.getTime()
  const input = {
    viewId: null,
    viewGraph: {
      concepts: ['urn:a', 'urn:b'].map((id) => ({ id, label: id, position: { x: 0, y: 0 } })),
      relations: [],
      relationTypes: [],
    },
    records: [...f.records.values()],
    now: f.now().getTime(),
  }
  assert.deepEqual(reviewBadge(input), { value: 1, refreshAt: due })
  assert.deepEqual(reviewBadge({ ...input, now: due }), { value: 2 })
  assert.deepEqual(reviewBadge({ ...input, viewGraph: { ...input.viewGraph, concepts: [] } }), {
    value: 0,
  })
})

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
    assert.deepEqual(f.calls[0].scope, { kind: 'concept', id: 'urn:a' })
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

test('undo restores the round and progress rating by rating, including after completion', async () => {
  const f = fixture()
  const review = await createReview(f.storage, f.now)
  review.setScope(['urn:a'])
  review.start()
  review.reveal()
  await review.rate(3)
  const before = review.getSnapshot().progress.get('urn:a')!
  const stored = structuredClone(f.records.get('urn:a'))
  f.advance(20 * 60_000)
  review.setScope(['urn:a', 'urn:b'])
  review.start()
  assert.deepEqual(review.getSnapshot().history, [])
  review.reveal()
  await review.rate(1)
  review.reveal()
  await review.rate(4)
  assert.deepEqual(review.getSnapshot().outcome, { reviewed: 2, complete: true })
  await review.undo()
  assert.deepEqual(review.getSnapshot().session, {
    ids: ['urn:b', 'urn:a'],
    index: 1,
    revealed: true,
  })
  assert.equal(review.getSnapshot().outcome, null)
  assert.equal(review.getSnapshot().progress.get('urn:a'), before)
  assert.deepEqual(f.records.get('urn:a'), stored)
  await review.undo()
  assert.deepEqual(review.getSnapshot().session, {
    ids: ['urn:b', 'urn:a'],
    index: 0,
    revealed: true,
  })
  assert.equal(f.records.has('urn:b'), false)
  assert.equal(review.getSnapshot().progress.has('urn:b'), false)
  const snapshot = review.getSnapshot()
  await review.undo()
  assert.equal(review.getSnapshot(), snapshot)
  await review.rate(3)
  review.finish()
  await review.undo()
  assert.equal(review.getSnapshot().session, null)
  assert.ok(f.records.has('urn:b'))
})

test('undo skips concepts removed from scope and blocks after failed writes', async () => {
  const f = fixture()
  const review = await createReview(f.storage, f.now)
  review.setScope(['urn:a', 'urn:b', 'urn:c'])
  review.start()
  review.reveal()
  await review.rate(3)
  review.setScope(['urn:b'])
  await review.undo()
  assert.deepEqual(review.getSnapshot().session, {
    ids: ['urn:b'],
    index: 0,
    revealed: false,
  })
  assert.equal(f.records.size, 0)
  review.reveal()
  await review.rate(3)
  review.setScope([])
  await review.undo()
  assert.equal(review.getSnapshot().session, null)
  assert.deepEqual(review.getSnapshot().outcome, { reviewed: 0, complete: false })
  review.setScope(['urn:a'])
  review.start()
  review.reveal()
  await review.rate(3)
  f.fail()
  await review.undo()
  assert.equal(review.getSnapshot().failed, true)
  assert.equal(review.getSnapshot().history.length, 1)
  assert.ok(review.getSnapshot().progress.has('urn:a'))
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
    f.records.set('urn:a', { key: 'progress', scope: { kind: 'concept', id: 'urn:a' }, value })
    await assert.rejects(createReview(f.storage, f.now), PluginError)
    assert.deepEqual(f.records.get('urn:a')?.value, value)
  }
})

test('version 1 progress keeps its schedule and only the latest logs from the next rating', async () => {
  const f = fixture()
  const first = await createReview(f.storage, f.now)
  first.setScope(['urn:a'])
  first.start()
  first.reveal()
  await first.rate(3)
  const { version, ...stored } = f.records.get('urn:a')!.value as {
    version: number
    card: { reps: number }
    logs: Value[]
  }
  assert.equal(version, 2)
  const logs = Array.from({ length: 30 }, () => stored.logs[0])
  const legacy = { ...stored, card: { ...stored.card, reps: 30 }, logs }
  f.records.set('urn:a', {
    key: 'progress',
    scope: { kind: 'concept', id: 'urn:a' },
    value: legacy,
  })
  const reopened = await createReview(f.storage, f.now)
  assert.equal(reopened.getSnapshot().progress.get('urn:a')!.logs.length, 20)
  assert.equal(reopened.getSnapshot().progress.get('urn:a')!.card.reps, 30)
  assert.deepEqual(f.records.get('urn:a')!.value, legacy)
  f.advance(400 * 86_400_000)
  reopened.setScope(['urn:a'])
  reopened.start()
  reopened.reveal()
  await reopened.rate(3)
  const upgraded = f.records.get('urn:a')!.value as typeof stored & { version: number }
  assert.equal(upgraded.version, 2)
  assert.equal(upgraded.card.reps, 31)
  assert.equal(upgraded.logs.length, 20)
  assert.deepEqual(
    upgraded.logs.at(-1),
    JSON.parse(JSON.stringify(reopened.getSnapshot().progress.get('urn:a')!.logs.at(-1))),
  )
  const invalid = [
    { ...legacy, card: { ...legacy.card, reps: 29 } },
    { ...legacy, version: 2 },
    { ...legacy, version: 2, logs: logs.slice(0, 5) },
    { ...upgraded, version: 3 },
  ]
  for (const value of invalid) {
    f.records.set('urn:a', { key: 'progress', scope: { kind: 'concept', id: 'urn:a' }, value })
    await assert.rejects(createReview(f.storage, f.now), PluginError)
  }
})
