import { PluginError, runtimeLimits, type BaseState } from '@nesso/plugin/runtime'

export function loadPluginFrame(element: HTMLIFrameElement, assets: { entry: string | Uint8Array }, connect: (port: MessagePort, ready: () => void, failed: (error: PluginError) => void) => {
  close: () => void
  bootstrap: { state: BaseState; mode: 'actions'; kind: 'actions' }
}, failed: (error: PluginError) => void) {
  const controller = new AbortController()
  const token = crypto.randomUUID()
  let connection: ReturnType<typeof connect> | undefined
  let disposed = false
  const stop = () => {
    if (disposed) return
    disposed = true
    clearTimeout(deadline)
    controller.abort()
    window.removeEventListener('message', navigated)
    connection?.close()
    element.onload = null
    element.src = 'about:blank'
  }
  const fail = (error: PluginError) => { if (!disposed) { stop(); failed(error) } }
  const deadline = setTimeout(() => fail(new PluginError('timeout', [{ path: 'plugin', message: 'Plugin loading timed out' }])), runtimeLimits.initialization)
  const navigated = (event: MessageEvent) => {
    if (event.source === element.contentWindow && event.data?.type === 'plugin-closed' && event.data.token === token) fail(new PluginError('closed', [{ path: 'plugin', message: 'Plugin navigated away' }]))
  }
  window.addEventListener('message', navigated)
  const fetchAsset = async (asset: string | Uint8Array) => {
    let bytes: Uint8Array
    if (typeof asset === 'string') {
      const response = await fetch(new URL(asset, document.baseURI), { signal: controller.signal, cache: 'no-store' })
      if (!response.ok) throw new PluginError('failed', [{ path: 'package', message: 'Could not load bundled plugin assets' }])
      bytes = new Uint8Array(await response.arrayBuffer())
    } else bytes = asset
    if (bytes.byteLength > 16 * 1024 * 1024) throw new PluginError('invalid-input', [{ path: 'package', message: 'Plugin asset limit exceeded' }])
    return new Uint8Array(bytes)
  }
  void fetchAsset(assets.entry).then((code) => {
    if (disposed) return
    const source = `data:text/javascript;base64,${btoa(Array.from(code, (byte) => String.fromCharCode(byte)).join(''))}`
    element.onload = () => {
      if (disposed) return
      if (connection) { fail(new PluginError('closed', [{ path: 'plugin', message: 'Plugin navigated away' }])); return }
      const channel = new MessageChannel()
      try {
        connection = connect(channel.port1, () => clearTimeout(deadline), fail)
        element.contentWindow!.postMessage({ ...connection.bootstrap, type: 'bootstrap', token, entry: source }, '*', [channel.port2])
      } catch (error) {
        channel.port1.close()
        channel.port2.close()
        fail(error instanceof PluginError ? error : new PluginError('failed', [{ path: 'plugin', message: 'Could not connect plugin' }]))
      }
    }
    const url = new URL('plugin-runner/actions.html', document.baseURI)
    url.hash = token
    element.src = url.href
  }).catch((error: unknown) => fail(error instanceof PluginError ? error : new PluginError('failed', [{ path: 'plugin', message: 'Could not initialize plugin' }])))
  return stop
}
