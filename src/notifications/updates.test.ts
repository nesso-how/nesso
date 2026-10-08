import assert from 'node:assert/strict'
import test from 'node:test'
import { createTranslator } from '@nesso/i18n'
import type { UpdateBridge, UpdateState } from '../../electron/updates.ts'
import en from '../i18n/en.json' with { type: 'json' }
import { createNotifications } from './create.ts'
import { connectUpdateNotifications } from './updates.ts'

test('update notifications replace reminders, require confirmation and clean up without touching other messages', (context) => {
  const notifications = createNotifications()
  const existingId = notifications.api.notify({ tone: 'info', title: 'Exported' })
  let receive = (_state: UpdateState) => {}
  const unsubscribe = context.mock.fn()
  const updater: UpdateBridge = {
    subscribe: (listener) => { receive = listener; return unsubscribe },
    restart: () => receive({ status: 'installing' }),
    beforeInstall: () => () => {},
  }
  const restart = context.mock.method(updater, 'restart')
  const t = createTranslator(en)('en')
  const stop = connectUpdateNotifications(updater, notifications.api, () => t)
  receive({ status: 'ready' })
  receive({ status: 'ready' })
  assert.equal(notifications.getSnapshot().length, 2)
  assert.equal(restart.mock.callCount(), 0)
  const ready = notifications.getSnapshot()[1]
  assert.ok(ready.tone === 'confirmation')
  ready.action.onClick()
  assert.equal(restart.mock.callCount(), 1)
  assert.deepEqual(notifications.getSnapshot().map((item) => item.id), [existingId])
  receive({ status: 'ready', error: 'save' })
  const failed = notifications.getSnapshot()[1]
  assert.ok(failed.tone === 'confirmation')
  assert.equal(failed.description, en.updateSaveFailure)
  failed.cancelAction.onClick()
  assert.equal(notifications.getSnapshot().length, 1)
  receive({ status: 'ready' })
  stop()
  assert.equal(unsubscribe.mock.callCount(), 1)
  assert.deepEqual(notifications.getSnapshot().map((item) => item.id), [existingId])
})
