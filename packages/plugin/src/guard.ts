const token = location.hash.slice(1)
const bootstrap = (event: MessageEvent) => {
  if (event.source !== parent || event.data?.type !== 'bootstrap' || event.data.token !== token || event.ports.length !== 1) return
  window.removeEventListener('message', bootstrap)
  const frame = document.querySelector<HTMLIFrameElement>('iframe')!
  window.addEventListener('message', (event) => {
    if (event.source === frame.contentWindow && event.data?.type === 'worker-failed' && event.data.token === token) parent.postMessage({ type: 'plugin-closed', token }, '*')
  })
  window.addEventListener('focus', () => frame.contentWindow!.focus())
  let connected = false
  frame.addEventListener('load', () => {
    if (connected) { parent.postMessage({ type: 'plugin-closed', token }, '*'); return }
    connected = true
    frame.contentWindow!.postMessage(event.data, '*', [event.ports[0]])
  })
  frame.srcdoc = document.querySelector<HTMLTemplateElement>('#runner')!.innerHTML
}
window.addEventListener('message', bootstrap)
