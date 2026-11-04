const token = location.hash.slice(1)
const frame = document.querySelector<HTMLIFrameElement>('iframe')!
let pending: MessageEvent | undefined
let started = false
let connected = false
const send = (event: MessageEvent) =>
  frame.contentWindow!.postMessage(event.data, '*', [event.ports[0]])
const bootstrap = (event: MessageEvent) => {
  if (
    event.source !== parent ||
    event.data?.type !== 'bootstrap' ||
    event.data.token !== token ||
    event.ports.length !== 1
  )
    return
  if (connected) {
    send(event)
    return
  }
  pending?.ports[0].close()
  pending = event
  if (started) return
  started = true
  window.addEventListener('message', (event) => {
    if (
      event.source === frame.contentWindow &&
      event.data?.type === 'worker-failed' &&
      event.data.token === token
    )
      parent.postMessage({ type: 'plugin-closed', token }, '*')
  })
  window.addEventListener('focus', () => frame.contentWindow!.focus())
  frame.addEventListener('load', () => {
    if (connected) {
      parent.postMessage({ type: 'plugin-closed', token }, '*')
      return
    }
    connected = true
    send(pending!)
    pending = undefined
  })
  frame.srcdoc = document.querySelector<HTMLTemplateElement>('#runner')!.innerHTML
}
window.addEventListener('message', bootstrap)
