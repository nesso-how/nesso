import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConceptMapHandle } from '@nesso-how/concept-map'
import type { SavedView } from '@nesso-how/core'
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
import { useAppCommands } from '@/app-commands'
import { PluginApprovalDialog } from '@/components/app/PluginApprovalDialog'
import { UpdateBar } from '@/components/app/UpdateBar'
import { PluginContent } from '@/components/app/PluginPanel'
import { pluginPanel as activePluginPanel, openCanvasTabAt, usePluginPanel } from '@/plugins'
import { ViewHeader } from '@/components/app/ViewHeader'
import { SearchDialog } from '@/components/app/SearchDialog'
import { openSearchResult } from '@/graph/search'

export default function App({ persistence }: { persistence: ReturnType<typeof startAutosave> }) {
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const t = translate(locale)
  const panels = useNessoStore((state) => state.preferences.panels)
  const { width: inspectorWidth, minWidth: inspectorMinWidth } = resolveInspector(panels, !!chat)
  const detailsOpen = useNessoStore(
    (state) => !state.preferences.collapsedSections?.includes('inspector'),
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const openSearch = useCallback(() => setSearchOpen(true), [setSearchOpen])
  const [introOpen, setIntroOpen] = useState(() => !host.store.getState().preferences.introSeen)
  const [settingsPage, setSettingsPage] = useState('general')
  const [deleting, setDeleting] = useState<SavedView | 'complete-graph' | null>(null)
  const canvas = useRef<HTMLDivElement>(null)
  const renderer = useRef<ConceptMapHandle>(null)
  const pluginPanel = usePluginPanel()
  const readonly = useMediaQuery('(max-width: 767px)')
  const deleteView = () => {
    const { workspace } = host.store.getState()
    setDeleting(
      workspace.activeViewId === null
        ? 'complete-graph'
        : (workspace.savedViews.find((view) => view.id === workspace.activeViewId) ?? null),
    )
  }

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  const openSettingsPage = useCallback(
    (page: string) => {
      setSettingsPage(page)
      setSettingsOpen(true)
    },
    [setSettingsPage, setSettingsOpen],
  )
  useAppCommands({
    store: host.store,
    readonly,
    introOpen,
    pluginPanel: !!pluginPanel,
    focusRef: canvas,
    openSettings: openSettingsPage,
    openSearch,
    openTab: openCanvasTabAt,
  })
  const openSettings = () => openSettingsPage('general')
  const finishIntro = () => {
    completeIntro(host.store)
    setIntroOpen(false)
    requestAnimationFrame(() => canvas.current?.focus())
  }

  return (
    <>
      <SidebarProvider>
        {introOpen ? (
          <Intro onFinish={finishIntro} />
        ) : (
          <div className="workspace-boot relative flex min-h-0 flex-1 overflow-hidden">
            {!readonly && <AppSidebar onOpenSettings={openSettings} onOpenSearch={openSearch} />}
            <SidebarInset className="relative min-w-0 overflow-hidden">
              <div className="flex min-h-0 flex-1">
                <div id="canvas" className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                  <ViewHeader readonly={readonly} />
                  <div className="relative min-h-0 flex-1">
                    <div
                      className="h-full"
                      style={{ contentVisibility: pluginPanel ? 'hidden' : undefined }}
                      inert={!!pluginPanel}
                    >
                      <GraphWorkspace
                        ref={renderer}
                        store={host.store}
                        suspended={!!pluginPanel}
                        onDeleteView={deleteView}
                        focusRef={canvas}
                      />
                    </div>
                    {pluginPanel && (
                      <div className="absolute inset-0 flex flex-col">
                        <PluginContent panel={pluginPanel} />
                      </div>
                    )}
                  </div>
                </div>
                {!readonly && (
                  <SidePanel
                    id="inspector-panel"
                    side="right"
                    open={detailsOpen}
                    size={inspectorWidth}
                    minSize={inspectorMinWidth}
                    maxSize="45%"
                    onToggle={() => host.store.setSectionOpen('inspector', !detailsOpen)}
                    onSizeChange={(inspectorWidth) =>
                      host.store.setPanelSizes({
                        ...host.store.getState().preferences.panels,
                        inspectorWidth,
                      })
                    }
                    toggleLabel={t(detailsOpen ? 'collapseDetails' : 'expandDetails')}
                    resizeLabel={t('resizeInspector')}
                  >
                    {chat ? (
                      <AssistantPanel
                        chat={chat}
                        onClose={() => host.store.setSectionOpen('inspector', false)}
                        onOpenSettings={() => {
                          setSettingsPage('ai')
                          setSettingsOpen(true)
                        }}
                        settingsOpen={settingsOpen}
                      />
                    ) : (
                      <Inspector />
                    )}
                  </SidePanel>
                )}
              </div>
            </SidebarInset>
          </div>
        )}
        <PersistenceBanner persistence={persistence} />
      </SidebarProvider>
      {(readonly || !settingsOpen) && <ToastsHost />}
      <SearchDialog
        store={host.store}
        open={!readonly && !introOpen && searchOpen}
        onOpenChange={setSearchOpen}
        focusRef={canvas}
        onSelect={(result) => {
          activePluginPanel.close()
          openSearchResult(host.store, result)
          if (result.kind === 'concept') renderer.current?.focusConcept(result.id)
        }}
      />
      {window.nessoUpdater && <UpdateBar updater={window.nessoUpdater} />}
      <Dialog.Root open={!readonly && settingsOpen} onOpenChange={setSettingsOpen}>
        {!readonly && settingsOpen && (
          <SettingsDialog
            page={settingsPage}
            onPageChange={setSettingsPage}
            onDiscover={() => {
              setSettingsOpen(false)
              setIntroOpen(true)
            }}
          />
        )}
      </Dialog.Root>
      {window.nessoPlugins && <PluginApprovalDialog bridge={window.nessoPlugins} />}
      {window.nessoDataLocation && <DataTransferDialog bridge={window.nessoDataLocation} />}
      <DeleteViewDialog
        target={deleting}
        onClose={() => setDeleting(null)}
        finalFocus={() => canvas.current}
      />
    </>
  )
}
