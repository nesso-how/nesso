import { resolvePluginEntry } from './module.ts'

let worker: Worker | undefined
let closed = false
const bootstrap = async (event: MessageEvent) => {
  if (event.source !== parent || event.data?.type !== 'bootstrap' || event.ports.length !== 1)
    return
  window.removeEventListener('message', bootstrap)
  const fail = () => {
    parent.postMessage({ type: 'worker-failed', token: event.data.token }, '*')
    worker?.terminate()
  }
  try {
    const entry = await resolvePluginEntry(
      event.data.entry,
      document.querySelector<HTMLScriptElement>('#react-runtime')!.textContent!,
    )
    if (closed) return
    worker = new Worker(document.querySelector<HTMLScriptElement>('#worker-source')!.textContent!, {
      type: 'module',
    })
    worker.onerror = fail
    worker.postMessage({ type: 'bootstrap', entry }, [event.ports[0]])
  } catch {
    fail()
  }
}
window.addEventListener('message', bootstrap)
window.addEventListener(
  'pagehide',
  () => {
    closed = true
    worker?.terminate()
  },
  { once: true },
)
