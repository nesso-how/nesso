import assert from 'node:assert/strict'
import test from 'node:test'
import { createNotifications } from './create.ts'

test('notification queues own messages and actions, stay isolated and notify only on changes', (context) => {
  const queue = createNotifications()
  const other = createNotifications()
  const before = queue.getSnapshot()
  const confirm = context.mock.fn()
  const cancel = context.mock.fn()
  const draft = {
    tone: 'confirmation' as const,
    title: 'Continue?',
    action: { label: 'Continue', onClick: confirm },
    cancelAction: { label: 'Cancel', onClick: cancel },
  }
  const id = queue.api.notify(draft)
  draft.title = 'Changed'
  draft.action.label = 'Changed'
  draft.cancelAction.onClick = confirm
  const [item] = queue.getSnapshot()
  assert.ok(item.tone === 'confirmation')
  assert.equal(item.id, id)
  assert.equal(item.title, 'Continue?')
  assert.equal(item.action.label, 'Continue')
  assert.equal(item.cancelAction.onClick, cancel)
  assert.equal(before.length, 0)
  assert.equal(other.getSnapshot().length, 0)

  const listener = context.mock.fn()
  const unsubscribe = queue.subscribe(listener)
  queue.api.dismiss('unknown')
  assert.equal(listener.mock.callCount(), 0)
  queue.api.dismiss(id)
  assert.equal(listener.mock.callCount(), 1)
  assert.equal(queue.getSnapshot().length, 0)
  unsubscribe()
  queue.api.notify({ tone: 'warning', title: 'Failed' })
  assert.equal(listener.mock.callCount(), 1)
  assert.equal(confirm.mock.callCount(), 0)
  assert.equal(cancel.mock.callCount(), 0)
})
