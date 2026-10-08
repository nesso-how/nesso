import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { defaultLocale } from '@nesso/i18n'
import '@/plugins'
import { notifications } from '@/notifications'
import { host, startAutosave } from '@/store'
import { connectTheme } from '@/theme'
import { connectUpdateNotifications } from '@/notifications/updates'
import { translate } from '@/i18n'
import './index.css'
import App from './App'

const stopTheme = connectTheme(host, document.documentElement)
const stopAutosave = startAutosave()
const stopUpdateNotifications = connectUpdateNotifications(
  window.nessoUpdater,
  notifications.api,
  () => translate(host.store.getState().preferences.locale ?? defaultLocale),
)
import.meta.hot?.dispose(() => {
  stopTheme()
  stopAutosave()
  stopUpdateNotifications()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
