import assert from 'node:assert/strict'
import test from 'node:test'
import { PluginError, runtimeLimits } from '@nesso-how/plugin/runtime'
import { withInitializationTimeout } from './initialization.ts'

test('plugin initialization aborts stalled work on timeout', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let loading: AbortSignal | undefined
  const task = withInitializationTimeout((signal) => {
    loading = signal
    return new Promise(() => {})
  }, new AbortController().signal)
  const rejected = assert.rejects(task, (error) => error instanceof PluginError && error.code === 'timeout')
  context.mock.timers.tick(runtimeLimits.initialization)
  await rejected
  assert.equal(loading?.aborted, true)
})
