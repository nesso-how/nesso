const guard = location.hash.slice(1)
const template = document.querySelector<HTMLTemplateElement>('#runner')!
const content = template.innerHTML
let frame: HTMLIFrameElement | undefined
let token: string | undefined
let pending: MessageEvent | undefined
let connected = false
const reset = () => {
  pending?.ports[0].close()
  pending = undefined
  frame?.remove()
  frame = undefined
  token = undefined
  connected = false
}
const send = (event: MessageEvent) =>
  frame!.contentWindow!.postMessage(event.data, '*', [event.ports[0]])
window.addEventListener('focus', () => frame?.contentWindow?.focus())
window.addEventListener('message', (event: MessageEvent) => {
  if (
    frame &&
    event.source === frame.contentWindow &&
    event.data?.type === 'worker-failed' &&
    event.data.token === token
  )
    parent.postMessage({ type: 'plugin-closed', token }, '*')
  if (event.source !== parent || event.data?.guard !== guard) return
  if (event.data.type === 'reset') {
    if (event.data.token === token) reset()
    parent.postMessage({ type: 'plugin-reset', guard, token: event.data.token }, '*')
    return
  }
  if (
    event.data.type !== 'bootstrap' ||
    typeof event.data.token !== 'string' ||
    event.ports.length !== 1
  )
    return
  if (event.data.token !== token) reset()
  token = event.data.token
  if (connected) {
    send(event)
    return
  }
  pending?.ports[0].close()
  pending = event
  if (frame) return
  const element = document.createElement('iframe')
  frame = element
  element.title = template.dataset.title!
  element.sandbox.add('allow-scripts')
  element.referrerPolicy = 'no-referrer'
  element.addEventListener('load', () => {
    if (frame !== element) return
    if (connected) {
      parent.postMessage({ type: 'plugin-closed', token }, '*')
      return
    }
    connected = true
    send(pending!)
    pending = undefined
  })
  element.srcdoc = content
  document.body.prepend(element)
})
