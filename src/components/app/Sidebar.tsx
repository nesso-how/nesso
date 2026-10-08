import type { SavedView } from '@nesso/plugin'
import { defaultLocale } from '@nesso/i18n'
import { Button, Dialog, DialogPopup, Menu, MenuItem, MenuPopup, ResizeHandle, SectionHeading } from '@nesso/ui'
import { MoreHorizontal, Pencil, Pin, PinOff, Settings2, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Sidebar } from './SidebarLayout'
import { NewViewButton } from './NewViewButton'
import { DeleteViewDialog } from './DeleteViewDialog'
import { ViewNameForm } from './ViewNameForm'
import { viewActions } from '@/plugins'
import { host, nessoStore, useNessoStore } from '@/store'
import { panelLimits } from '@/store/settings'
import { useTranslation } from '@/i18n'

function ViewActionGroup({ viewId }: { viewId: string | null }) {
  const t = useTranslation()
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  return (
    <Menu.Group>
      <Menu.GroupLabel className="px-2.5 pt-1 pb-0.5 text-[11px] leading-4 text-muted-foreground">{t('actions')}</Menu.GroupLabel>
      {viewActions.map((action) => <MenuItem key={action.id} className="pl-4" onClick={() => action.runOnView?.(viewId)}>{action.label(locale)}</MenuItem>)}
    </Menu.Group>
  )
}

export function AppSidebar({ readonly = false, bare = false, onNavigate, onOpenSettings }: { readonly?: boolean; bare?: boolean; onNavigate?: () => void; onOpenSettings?: () => void }) {
  const t = useTranslation()
  const workspace = useNessoStore((state) => state.workspace)
  const conceptCount = useNessoStore((state) => state.graph.concepts.length)
  const collapsed = useNessoStore((state) => state.preferences.collapsedSections)
  const pinnedOpen = !collapsed?.includes('sidebar.pinned-views')
  const viewsOpen = !collapsed?.includes('sidebar.views')
  const [deleting, setDeleting] = useState<SavedView | 'complete-graph' | null>(null)
  const [renaming, setRenaming] = useState<SavedView | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const createTrigger = useRef<HTMLButtonElement>(null)
  const menuTriggers = useRef(new Map<string, HTMLButtonElement>())
  const deletingId = useRef<string | null>(null)
  const renamingId = useRef<string | null>(null)
  const pinned = workspace.savedViews.filter((view) => view.pinned)
  const ordinary = workspace.savedViews.filter((view) => !view.pinned)

  useEffect(() => {
    const close = () => setMenu(null)
    window.addEventListener('resize', close)
    return () => window.removeEventListener('resize', close)
  }, [])

  const navigate = (viewId: string | null) => {
    nessoStore.setView(viewId)
    onNavigate?.()
  }

  const row = (view: SavedView) => (
    <div key={view.id} className="group flex min-h-14 items-center gap-1 rounded-sm hover:bg-accent has-[:focus-visible]:bg-accent has-[[aria-current]]:bg-pressed">
      <button
        type="button"
        onClick={() => navigate(view.id)}
        aria-current={workspace.activeViewId === view.id ? 'page' : undefined}
        className="min-w-0 flex-1 rounded-sm px-2.5 py-2 text-left"
      >
        <span className="block text-[13px] leading-[19px] break-words">{view.name}</span>
        <span className="mt-[3px] block font-mono text-[10px] leading-[14px] text-muted-foreground">{t('conceptCount', { count: view.conceptIds.length })}</span>
      </button>
      {!readonly && (
        <Menu.Root open={menu === view.id} onOpenChange={(open) => setMenu(open ? view.id : null)}>
          <Menu.Trigger ref={(element: HTMLButtonElement | null) => {
            if (element) menuTriggers.current.set(view.id, element)
            else menuTriggers.current.delete(view.id)
          }} render={<Button variant="ghost" size="icon-sm" className="mr-1 text-muted-foreground opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 data-popup-open:opacity-100 hover:bg-transparent hover:text-foreground active:bg-transparent [@media(pointer:coarse)]:opacity-100" aria-label={t('actionsFor', { name: view.name })} />}>
            <MoreHorizontal />
          </Menu.Trigger>
          <MenuPopup>
            <MenuItem onClick={() => {
              renamingId.current = view.id
              setRenaming(view)
            }}><Pencil />{t('renameView')}</MenuItem>
            <MenuItem onClick={() => {
              host.store.setViewPinned(view.id, !view.pinned)
              requestAnimationFrame(() => {
                const trigger = menuTriggers.current.get(view.id)
                const target = trigger?.getClientRects().length ? trigger : createTrigger.current
                target?.focus()
              })
            }}>{view.pinned ? <PinOff /> : <Pin />}{t(view.pinned ? 'unpinView' : 'pinView')}</MenuItem>
            <Menu.Separator className="my-1 h-px bg-border" />
            <ViewActionGroup viewId={view.id} />
            <Menu.Separator className="my-1 h-px bg-border" />
            <MenuItem onClick={() => { deletingId.current = view.id; setDeleting(view) }}><Trash2 />{t('deleteView')}</MenuItem>
          </MenuPopup>
        </Menu.Root>
      )}
    </div>
  )

  const heading = (label: string, id: string, open: boolean, toggle: () => void) => (
    <SectionHeading open={open} className="min-h-8" aria-controls={id} onClick={toggle}>{label}</SectionHeading>
  )

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const handle = event.currentTarget
    const wrapper = handle.closest<HTMLElement>('[data-slot="sidebar-wrapper"]')
    handle.dataset.resizing = ''
    let width = host.store.getState().preferences.panels.explorerWidth
    const onMove = (move: PointerEvent) => {
      width = Math.min(panelLimits.explorerWidth.max, Math.max(panelLimits.explorerWidth.min, move.clientX))
      wrapper?.style.setProperty('--sidebar-width', `${width}px`)
    }
    const stop = () => {
      delete handle.dataset.resizing
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', stop)
      host.store.setPanelSizes({ ...host.store.getState().preferences.panels, explorerWidth: width })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', stop)
  }

  const content = (
    <>
      <div className="flex min-h-0 flex-1 flex-col px-3 pt-5">
        {!readonly && <NewViewButton ref={createTrigger} />}
        {heading(t('pinnedViews'), 'pinned-views', pinnedOpen, () => host.store.setSectionOpen('sidebar.pinned-views', !pinnedOpen))}
        <div className="explorer-scroll min-h-0 flex-1 overflow-y-auto p-1.5 -mx-1.5" onScroll={() => setMenu(null)}>
          <div id="pinned-views" hidden={!pinnedOpen} className="mt-1 space-y-0.5">
            <div className="group flex min-h-14 items-center gap-1 rounded-sm hover:bg-accent has-[:focus-visible]:bg-accent has-[[aria-current]]:bg-pressed">
              <button type="button" onClick={() => navigate(null)} aria-current={workspace.activeViewId === null ? 'page' : undefined} className="min-w-0 flex-1 rounded-sm px-2.5 py-2 text-left">
                <span className="block text-[13px] leading-[19px]">{t('completeGraph')}</span>
                <span className="mt-[3px] block font-mono text-[10px] leading-[14px] text-muted-foreground">{t('conceptCount', { count: conceptCount })}</span>
              </button>
              {!readonly && (
                <Menu.Root open={menu === 'complete-graph'} onOpenChange={(open) => setMenu(open ? 'complete-graph' : null)}>
                  <Menu.Trigger ref={(element: HTMLButtonElement | null) => {
                    if (element) menuTriggers.current.set('complete-graph', element)
                    else menuTriggers.current.delete('complete-graph')
                  }} render={<Button variant="ghost" size="icon-sm" className="mr-1 text-muted-foreground opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 data-popup-open:opacity-100 hover:bg-transparent hover:text-foreground active:bg-transparent [@media(pointer:coarse)]:opacity-100" aria-label={t('actionsFor', { name: t('completeGraph') })} />}>
                    <MoreHorizontal />
                  </Menu.Trigger>
                  <MenuPopup>
                    <ViewActionGroup viewId={null} />
                    <Menu.Separator className="my-1 h-px bg-border" />
                    <MenuItem onClick={() => { deletingId.current = 'complete-graph'; setDeleting('complete-graph') }}><Trash2 />{t('deleteView')}</MenuItem>
                  </MenuPopup>
                </Menu.Root>
              )}
            </div>
            {pinned.map(row)}
          </div>
          <div className="mt-4">
            {heading(t('views'), 'saved-views', viewsOpen, () => host.store.setSectionOpen('sidebar.views', !viewsOpen))}
            <div id="saved-views" hidden={!viewsOpen} className="mt-1 space-y-0.5">{ordinary.map(row)}</div>
          </div>
        </div>
      </div>
      <div className="shrink-0 border-t px-3 py-2">
        <Button data-settings-trigger variant="ghost" className="w-full justify-start text-muted-foreground" onClick={onOpenSettings}><Settings2 />{t('settings')}</Button>
      </div>
    </>
  )

  return (
    <>
      {bare ? content : (
        <Sidebar>
          {content}
          <ResizeHandle onPointerDown={startResize} aria-label={t('resizeSidebar')} className="absolute inset-y-0 right-0 z-20 cursor-col-resize bg-transparent" />
        </Sidebar>
      )}
      {!readonly && (
        <Dialog.Root open={renaming !== null} onOpenChange={(open) => { if (!open) setRenaming(null) }}>
          <DialogPopup finalFocus={() => menuTriggers.current.get(renamingId.current ?? '') ?? createTrigger.current}>
            <Dialog.Title className="text-sm">{t('renameView')}</Dialog.Title>
            <Dialog.Description className="mt-2 text-xs text-muted-foreground">{t('renameDescription')}</Dialog.Description>
            {renaming && <ViewNameForm initialName={renaming.name} submitLabel={t('saveName')} onSubmit={(name) => {
              host.store.renameView(renaming.id, name)
              setRenaming(null)
            }} />}
          </DialogPopup>
        </Dialog.Root>
      )}
      {!readonly && <DeleteViewDialog target={deleting} onClose={() => setDeleting(null)} finalFocus={() => menuTriggers.current.get(deletingId.current ?? '') ?? createTrigger.current} />}
    </>
  )
}
