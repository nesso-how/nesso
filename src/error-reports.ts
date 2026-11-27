import { reportError } from './logs.ts'

window.addEventListener('error', (event) => {
  if (event.error) reportError('window-error', event.error)
})
window.addEventListener('unhandledrejection', (event) =>
  reportError('unhandled-rejection', event.reason),
)
