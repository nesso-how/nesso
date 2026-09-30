import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/plugins'
import { host, startAutosave } from '@/store'
import { connectTheme } from '@/theme'
import './index.css'
import App from './App'

const stopTheme = connectTheme(host, document.documentElement)
const stopAutosave = startAutosave()
import.meta.hot?.dispose(() => {
  stopTheme()
  stopAutosave()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
