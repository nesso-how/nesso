import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { defaultLocale } from '@nesso/i18n'
import '@/plugins'
import { notifications } from '@/notifications'
import { host, startAutosave } from '@/store'
import { connectTheme } from '@/theme'
import { connectUpdateNotifications } from '@/notifications/updates'
import { translate } from '@/i18n'
import { chat } from '@/ai'
import { connectMcpHost } from '@/ai/mcp'
import { createAiApproval, createAiHistoryApproval } from '@/ai/approval'
import './index.css'
import App from './App'

const stopTheme = connectTheme(host, document.documentElement)
const stopAutosave = startAutosave()
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
) : () => {}
window.addEventListener('pagehide', stopChat)
window.addEventListener('pagehide', stopMcp)
import.meta.hot?.dispose(() => {
  stopTheme()
  stopAutosave()
  stopUpdateNotifications()
  chat?.dispose()
  stopMcp()
  window.removeEventListener('pagehide', stopChat)
  window.removeEventListener('pagehide', stopMcp)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
