import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { defaultLocale } from '@nesso-how/i18n'
import { getThemePresentation, initializeBundledPlugins, initializeExternalPlugins, stopPluginActions } from '@/plugins'
import { notifications } from '@/notifications'
import { host, startAutosave } from '@/store'
import { connectTheme } from '@/theme'
import { connectUpdateNotifications } from '@/notifications/updates'
import { translate } from '@/i18n'
import { chat, documentation } from '@/ai'
import { connectMcpHost } from '@/ai/mcp'
import { createAiApproval, createAiHistoryApproval } from '@/ai/approval'
import './index.css'
import App from './App'
import { Splash } from '@/components/app/Splash'

const root = createRoot(document.getElementById('root')!)
const animate = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type !== 'reload'
const showApp = () => root.render(<StrictMode><App persistence={persistence} /></StrictMode>)
const showSplash = (ready: boolean) => root.render(<StrictMode><Splash ready={ready} animate={animate} onDone={showApp} /></StrictMode>)
showSplash(false)

const framePolicy = document.createElement('meta')
framePolicy.httpEquiv = 'Content-Security-Policy'
framePolicy.content = `frame-src ${new URL('plugin-runner/actions.html', document.baseURI).href}`
document.head.append(framePolicy)

const showPluginRecovery = (message: string, label: string, action: () => void) => {
  root.render(<div role="alert" className="startup-recovery"><p>{message}</p><button onClick={action}>{label}</button></div>)
}

try { await initializeBundledPlugins() }
catch (error) {
  const t = translate(host.store.getState().preferences.locale ?? defaultLocale)
  showPluginRecovery(t('pluginsFailed'), t('pluginsRetry'), () => location.reload())
  throw error
}
const fonts = document.createElement('style')
document.head.append(fonts)
const stopTheme = connectTheme(host, (definition) => {
  const theme = getThemePresentation(definition.id)!
  for (const [key, value] of Object.entries(theme.tokens)) document.documentElement.style.setProperty(`--${key}`, value)
  fonts.textContent = theme.fontStyles
  document.documentElement.setAttribute('data-theme', definition.id)
})
const externalStartup = new AbortController()
const stopExternalPlugins = await initializeExternalPlugins(externalStartup.signal)
const persistence = startAutosave(stopPluginActions)
const stopUpdateNotifications = connectUpdateNotifications(
  window.nessoUpdater,
  notifications.api,
  () => translate(host.store.getState().preferences.locale ?? defaultLocale),
)
const stopChat = () => chat?.stop()
const getTranslation = () => translate(host.store.getState().preferences.locale ?? defaultLocale)
const stopMcp = window.nessoMcp ? connectMcpHost(
  window.nessoMcp, host,
  createAiApproval(notifications.api, getTranslation, 'mcpApproval'),
  createAiHistoryApproval(notifications.api, getTranslation),
  () => !!chat && chat.getSnapshot().phase !== 'idle',
  documentation,
) : () => {}
window.addEventListener('pagehide', stopChat)
window.addEventListener('pagehide', stopMcp)
window.addEventListener('pagehide', stopPluginActions)
window.addEventListener('pagehide', stopExternalPlugins)
import.meta.hot?.dispose(() => {
  stopTheme()
  fonts.remove()
  persistence.dispose()
  stopUpdateNotifications()
  chat?.dispose()
  stopMcp()
  stopPluginActions()
  stopExternalPlugins()
  window.removeEventListener('pagehide', stopChat)
  window.removeEventListener('pagehide', stopMcp)
  window.removeEventListener('pagehide', stopPluginActions)
  window.removeEventListener('pagehide', stopExternalPlugins)
})

showSplash(true)
