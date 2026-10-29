import { useEffect, useRef, useState } from 'react'
import type { SavedView } from '@nesso-how/plugin'
import { defaultLocale } from '@nesso-how/i18n'
import { Inspector } from '@/components/app/Inspector'
import { ToastsHost } from '@/components/app/Toasts'
import { PersistenceBanner } from '@/components/app/PersistenceBanner'
import { AppSidebar } from '@/components/app/Sidebar'
import { SettingsDialog } from '@/components/app/SettingsDialog'
import { Dialog, SidePanel, useMediaQuery } from '@nesso-how/ui'
import { SidebarInset, SidebarProvider } from '@/components/app/SidebarLayout'
import { host, useNessoStore, type startAutosave } from '@/store'
import { resolveInspector } from '@/store/settings'
import { translate } from '@/i18n'
import { chat } from '@/ai'
import { AssistantPanel } from '@/components/app/AssistantPanel'
import { DataTransferDialog } from '@/components/app/LocalDataSettings'
import { Intro } from '@/components/app/Intro'
import { completeIntro } from '@/store/intro'
import { DeleteViewDialog } from '@/components/app/DeleteViewDialog'
import { GraphWorkspace } from '@/components/app/GraphWorkspace'
import { isEditableTarget } from '@/graph/interactions'
import { PluginApprovalDialog } from '@/components/app/PluginApprovalDialog'
import { UpdateBar } from '@/components/app/UpdateBar'

export default function App({ persistence }: { persistence: ReturnType<typeof startAutosave> }) {
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const t = translate(locale)
  const panels = useNessoStore((state) => state.preferences.panels)
  const { width: inspectorWidth, minWidth: inspectorMinWidth } = resolveInspector(panels, !!chat)
  const detailsOpen = useNessoStore((state) => !state.preferences.collapsedSections?.includes('inspector'))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [introOpen, setIntroOpen] = useState(() => !host.store.getState().preferences.introSeen)
  const [settingsPage, setSettingsPage] = useState('general')
  const [deleting, setDeleting] = useState<SavedView | 'complete-graph' | null>(null)
  const canvas = useRef<HTMLDivElement>(null)
  const readonly = useMediaQuery('(max-width: 767px)')
  const deleteView = () => {
    const { workspace } = host.store.getState()
    setDeleting(workspace.activeViewId === null ? 'complete-graph' : workspace.savedViews.find((view) => view.id === workspace.activeViewId) ?? null)
  }

  useEffect(() => { document.documentElement.lang = locale }, [locale])
  useEffect(() => {
    if (readonly) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('[data-data-transfer][data-open]')) return
      if (event.defaultPrevented || event.isComposing || event.altKey) return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (event.key === '?' && !event.metaKey && !event.ctrlKey) {
        if (event.repeat || isEditableTarget(target) || target?.closest('[role="dialog"]:not(.settings-popup), [role="alertdialog"]')) return
        event.preventDefault()
        setSettingsPage('shortcuts')
        setSettingsOpen(true)
        return
      }
      if (introOpen || !(event.metaKey || event.ctrlKey)) return
      if (isEditableTarget(target) && !target?.hasAttribute('data-document-edit')) return
      const key = event.key.toLowerCase()
      if (key !== 'z' && !(key === 'y' && event.ctrlKey && !event.metaKey)) return
      event.preventDefault()
      if (key === 'y' || event.shiftKey) host.store.redo()
      else host.store.undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [readonly, introOpen])
  const openSettings = () => { setSettingsPage('general'); setSettingsOpen(true) }
  const finishIntro = () => {
    completeIntro(host.store)
    setIntroOpen(false)
    requestAnimationFrame(() => canvas.current?.focus())
  }

  return (
    <>
      <SidebarProvider>
        {introOpen ? <Intro onFinish={finishIntro} /> : (
        <div className="workspace-boot relative flex min-h-0 flex-1 overflow-hidden">
          {!readonly && <AppSidebar onOpenSettings={openSettings} />}
          <SidebarInset className="relative min-w-0 overflow-hidden">
            <div className="flex min-h-0 flex-1">
              <div id="canvas" className="relative min-h-0 min-w-0 flex-1">
                <GraphWorkspace store={host.store} onDeleteView={deleteView} focusRef={canvas} />
              </div>
              {!readonly && <SidePanel
                id="inspector-panel"
                side="right"
                open={detailsOpen}
                size={inspectorWidth}
                minSize={inspectorMinWidth}
                maxSize="45%"
                onToggle={() => host.store.setSectionOpen('inspector', !detailsOpen)}
                onSizeChange={(inspectorWidth) => host.store.setPanelSizes({ ...host.store.getState().preferences.panels, inspectorWidth })}
                toggleLabel={t(detailsOpen ? 'collapseDetails' : 'expandDetails')}
                resizeLabel={t('resizeInspector')}
              >
                {chat ? <AssistantPanel chat={chat} onClose={() => host.store.setSectionOpen('inspector', false)} onOpenSettings={() => { setSettingsPage('ai'); setSettingsOpen(true) }} settingsOpen={settingsOpen} /> : <Inspector />}
              </SidePanel>}
            </div>
          </SidebarInset>
        </div>
        )}
        <PersistenceBanner persistence={persistence} />
      </SidebarProvider>
      {(readonly || !settingsOpen) && <ToastsHost />}
      {window.nessoUpdater && <UpdateBar updater={window.nessoUpdater} />}
      <Dialog.Root open={!readonly && settingsOpen} onOpenChange={setSettingsOpen}>
        {!readonly && settingsOpen && <SettingsDialog page={settingsPage} onPageChange={setSettingsPage} onDiscover={() => { setSettingsOpen(false); setIntroOpen(true) }} />}
      </Dialog.Root>
      {window.nessoPlugins && <PluginApprovalDialog bridge={window.nessoPlugins} />}
      {window.nessoDataLocation && <DataTransferDialog bridge={window.nessoDataLocation} />}
      <DeleteViewDialog target={deleting} onClose={() => setDeleting(null)} finalFocus={() => canvas.current} />
    </>
  )
}
