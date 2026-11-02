import {
  badgeLimits,
  checkMessageSize,
  parseContribution,
  PluginError,
  runtimeLimits,
  type ActionBadgeInput,
  type ActionBadgeResult,
  type ActionDescriptor,
} from '@nesso-how/plugin/runtime'
import type { ActionPackage } from './actions.ts'
import { loadPluginFrame } from './frame.ts'
import { listenPluginPort } from './messages.ts'

export function connectBadgeChannel(
  port: MessagePort,
  descriptors: readonly ActionDescriptor[],
  actionId: string,
  input: ActionBadgeInput,
  effects: {
    ready: () => void
    complete: (value: ActionBadgeResult) => void
    failed: (error: PluginError) => void
  },
) {
  let closed = false
  let invoked = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const close = (error?: PluginError) => {
    if (closed) return
    closed = true
    clearTimeout(timer)
    port.close()
    if (error) effects.failed(error)
  }
  listenPluginPort(
    port,
    () => closed,
    (message) => {
      if (message.type === 'contribution' && !invoked) {
        const received = parseContribution('actions', message.value)
        if (
          JSON.stringify(received) !== JSON.stringify(descriptors) ||
          !received.some((action) => action.id === actionId && action.badge)
        )
          throw new PluginError('denied', [
            { path: 'badge', message: 'Badge provider changed after discovery' },
          ])
        invoked = true
        effects.ready()
        timer = setTimeout(
          () =>
            close(
              new PluginError('timeout', [{ path: 'badge', message: 'Badge execution timed out' }]),
            ),
          badgeLimits.execution,
        )
        checkMessageSize(input, runtimeLimits.snapshot)
        port.postMessage({ type: 'badge', actionId, input })
        return
      }
      if (message.type === 'badge-result' && invoked) {
        close()
        effects.complete(message.value)
        return
      }
      throw new PluginError('denied', [
        { path: 'badge', message: 'Badge executions may only return a badge result' },
      ])
    },
    close,
  )
  return { close }
}

export function executeActionBadge(
  source: ActionPackage,
  descriptors: readonly ActionDescriptor[],
  actionId: string,
  input: ActionBadgeInput,
  signal: AbortSignal,
): Promise<ActionBadgeResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new PluginError('cancelled', [{ path: 'badge', message: 'Badge cancelled' }]))
      return
    }
    const frame = document.createElement('iframe')
    frame.hidden = true
    frame.title = source.name
    frame.sandbox.add('allow-scripts')
    frame.referrerPolicy = 'no-referrer'
    document.body.append(frame)
    let closed = false
    const finish = (result: ActionBadgeResult | PluginError) => {
      if (closed) return
      closed = true
      signal.removeEventListener('abort', cancel)
      stop()
      frame.remove()
      if (result instanceof PluginError) reject(result)
      else resolve(result)
    }
    const cancel = () =>
      finish(new PluginError('cancelled', [{ path: 'badge', message: 'Badge cancelled' }]))
    const stop = loadPluginFrame(
      frame,
      { entry: source.entry },
      (port, ready) =>
        connectBadgeChannel(port, descriptors, actionId, input, {
          ready,
          complete: finish,
          failed: finish,
        }),
      finish,
    )
    signal.addEventListener('abort', cancel, { once: true })
  })
}
