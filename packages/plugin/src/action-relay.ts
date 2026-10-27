let worker: Worker | undefined
const bootstrap = (event: MessageEvent) => {
  if (event.source !== parent || event.data?.type !== 'bootstrap' || event.ports.length !== 1) return
  window.removeEventListener('message', bootstrap)
  worker = new Worker(document.querySelector<HTMLScriptElement>('#worker-source')!.textContent!, { type: 'module' })
  worker.onerror = () => {
    parent.postMessage({ type: 'worker-failed', token: event.data.token }, '*')
    worker?.terminate()
  }
  worker.postMessage({ type: 'bootstrap', entry: event.data.entry }, [event.ports[0]])
}
window.addEventListener('message', bootstrap)
window.addEventListener('pagehide', () => worker?.terminate(), { once: true })
