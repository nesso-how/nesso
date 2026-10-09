import { useEffect, useState } from 'react'
import { defaultLocale } from '@nesso/i18n'
import { Inspector } from '@/components/app/Inspector'
import { ToastsHost } from '@/components/app/Toasts'
import { PersistenceBanner } from '@/components/app/PersistenceBanner'
import { AppSidebar } from '@/components/app/Sidebar'
import { SettingsDialog } from '@/components/app/SettingsDialog'
import { Dialog, SidePanel, useMediaQuery } from '@nesso/ui'
import { SidebarInset, SidebarProvider } from '@/components/app/SidebarLayout'
import { getRenderer, host, useNessoStore } from '@/store'
import { panelLimits } from '@/store/settings'
import { translate } from '@/i18n'
import { chat } from '@/ai'
import { AssistantPanel } from '@/components/app/AssistantPanel'

function RendererHost() {
  const activeRendererId = useNessoStore((state) => state.preferences.activeRendererId)
  const renderer = getRenderer(activeRendererId)
  if (!renderer) return null
  const Component = renderer.component
  return (
    <div className="h-full">
      <Component />
    </div>
  )
}

export default function App() {
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const t = translate(locale)
  const panels = useNessoStore((state) => state.preferences.panels)
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsPage, setSettingsPage] = useState<'general' | 'ai'>('general')
  const readonly = useMediaQuery('(max-width: 767px)')

  useEffect(() => { document.documentElement.lang = locale }, [locale])
  useEffect(() => {
    if (readonly) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || !(event.metaKey || event.ctrlKey)) return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('input, textarea, [contenteditable="true"]') && !target.hasAttribute('data-document-edit')) return
      const key = event.key.toLowerCase()
      if (key !== 'z' && !(key === 'y' && event.ctrlKey && !event.metaKey)) return
      event.preventDefault()
      if (key === 'y' || event.shiftKey) host.store.redo()
      else host.store.undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [readonly])
  const openSettings = () => { setSettingsPage('general'); setSettingsOpen(true) }

  return (
    <>
      <SidebarProvider>
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {!readonly && <AppSidebar onOpenSettings={openSettings} />}
          <SidebarInset className="relative min-w-0 overflow-hidden">
            <div className="flex min-h-0 flex-1">
              <div id="canvas" className="relative min-h-0 min-w-0 flex-1">
                <RendererHost />
                <ToastsHost />
              </div>
              {!readonly && <SidePanel
                id="inspector-panel"
                side="right"
                open={detailsOpen}
                size={chat && panels.inspectorWidth < 300 ? 360 : panels.inspectorWidth}
                minSize={chat ? 300 : panelLimits.inspectorWidth.min}
                maxSize="45%"
                onToggle={() => setDetailsOpen((open) => !open)}
                onSizeChange={(inspectorWidth) => host.store.setPanelSizes({ ...host.store.getState().preferences.panels, inspectorWidth })}
                toggleLabel={t(detailsOpen ? 'collapseDetails' : 'expandDetails')}
                resizeLabel={t('resizeInspector')}
              >
                {chat ? <AssistantPanel chat={chat} onClose={() => setDetailsOpen(false)} onOpenSettings={() => { setSettingsPage('ai'); setSettingsOpen(true) }} settingsOpen={settingsOpen} /> : <Inspector />}
              </SidePanel>}
            </div>
            <PersistenceBanner />
          </SidebarInset>
        </div>
      </SidebarProvider>
      <Dialog.Root open={!readonly && settingsOpen} onOpenChange={setSettingsOpen}>
        {!readonly && settingsOpen && <SettingsDialog initialPage={settingsPage} />}
      </Dialog.Root>
    </>
  )
}
