import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/plugins'
import { startAutosave } from '@/store'
import './index.css'
import App from './App'

const stopAutosave = startAutosave()
import.meta.hot?.dispose(stopAutosave)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
