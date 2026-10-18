import { parseContribution, PluginError, type BaseState, type Definition } from '@nesso/plugin/runtime'
import { loadPluginFrame } from './frame.ts'
import { listenPluginPort } from './messages.ts'

export function connectDefinitionChannel(port: MessagePort, grant: { kind: 'theme' | 'vocab'; id?: string }, state: BaseState, registered: (definition: Definition) => void, failed: (error: PluginError) => void) {
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    port.postMessage({ type: 'close', reason: 'Definition registration finished' })
    port.close()
  }
  const fail = (error: PluginError) => { close(); failed(error) }
  listenPluginPort(port, () => closed, (message) => {
    if (message.type === 'contribution') {
      const definition = parseContribution(grant.kind, message.value)
      if (grant.id !== undefined && definition.id !== grant.id) throw new PluginError('denied', [{ path: 'contribution.id', message: 'Unexpected definition identity' }])
      close()
      registered(definition)
      return
    }
    if (message.type !== 'request') throw new PluginError('invalid-input', [{ path: 'channel', message: 'Unexpected definition message' }])
    if (message.method === 'store.refresh') {
      port.postMessage({ type: 'state', state })
      port.postMessage({ type: 'response', id: message.id, ok: true, value: null })
    } else {
      port.postMessage({ type: 'response', id: message.id, ok: false, error: { code: 'denied', issues: [{ path: 'definition', message: 'Definition instances cannot cause effects' }] } })
    }
  }, fail)
  return { close }
}

export function loadDefinition(assets: { id: string; expectedId?: string; kind: 'theme' | 'vocab'; entry: string | Uint8Array }, state: BaseState, signal?: AbortSignal): Promise<Definition> {
  return new Promise((resolve, reject) => {
    const cancelled = () => { cleanup(); reject(new PluginError('cancelled', [{ path: 'definition', message: 'Definition loading cancelled' }])) }
    let stop = () => {}
    const frame = document.createElement('iframe')
    frame.title = assets.id
    frame.hidden = true
    frame.sandbox.add('allow-scripts')
    frame.referrerPolicy = 'no-referrer'
    document.body.append(frame)
    const cleanup = () => {
      signal?.removeEventListener('abort', cancelled)
      stop()
      frame.remove()
    }
    if (signal?.aborted) { cancelled(); return }
    signal?.addEventListener('abort', cancelled, { once: true })
    stop = loadPluginFrame(frame, assets, (port, _ready, failed) => ({
      ...connectDefinitionChannel(port, { kind: assets.kind, id: assets.expectedId }, state, (definition) => { cleanup(); resolve(definition) }, failed),
      bootstrap: { mode: 'definition', kind: assets.kind, state },
    }), (error) => { cleanup(); reject(error) })
  })
}
