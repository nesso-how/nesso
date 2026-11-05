const guard = location.hash.slice(1)
const template = document.querySelector<HTMLTemplateElement>('#runner')!
const frame = document.createElement('iframe')
let loaded = false
window.addEventListener('focus', () => frame.contentWindow?.focus())
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source === frame.contentWindow && event.data?.token === guard) {
    if (event.data.type === 'worker-failed')
      parent.postMessage({ type: 'plugin-closed', guard }, '*')
    if (event.data.type === 'worker-ready') parent.postMessage({ type: 'plugin-ready', guard }, '*')
  }
  if (
    !loaded ||
    event.source !== parent ||
    event.data?.guard !== guard ||
    !(
      (event.data.type === 'prepare' && event.ports.length === 0) ||
      (event.data.type === 'bootstrap' && event.ports.length === 1)
    )
  )
    return
  frame.contentWindow!.postMessage(event.data, '*', [...event.ports])
})
frame.title = template.dataset.title!
frame.sandbox.add('allow-scripts')
frame.referrerPolicy = 'no-referrer'
frame.addEventListener('load', () => {
  if (loaded) {
    parent.postMessage({ type: 'plugin-closed', guard }, '*')
    return
  }
  loaded = true
})
frame.srcdoc = template.innerHTML
document.body.prepend(frame)
