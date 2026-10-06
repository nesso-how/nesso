import type { SavedView } from '@nesso/plugin'
import { downloadGraph } from '@nesso/export'
import { Button, Dialog, DialogPopup, Menu, MenuItem, MenuPopup, ResizeHandle, SectionHeading } from '@nesso/ui'
import { MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Sidebar } from './SidebarLayout'
import { NewViewButton } from './NewViewButton'
import { ViewNameForm } from './ViewNameForm'
import { host, nessoStore, useNessoStore } from '@/store'
import { panelLimits } from '@/store/settings'

export function AppSidebar() {
  const workspace = useNessoStore((state) => state.workspace)
  const collapsed = useNessoStore((state) => state.preferences.collapsedSections)
  const pinnedOpen = !collapsed?.includes('sidebar.pinned-views')
  const viewsOpen = !collapsed?.includes('sidebar.views')
  const [deleting, setDeleting] = useState<SavedView | null>(null)
  const [renaming, setRenaming] = useState<SavedView | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const cancel = useRef<HTMLButtonElement>(null)
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

  const row = (view: SavedView) => (
    <div key={view.id} className="group flex min-h-14 items-center gap-1 rounded-sm hover:bg-accent has-[:focus-visible]:bg-accent has-[[aria-current]]:bg-pressed">
      <button
        type="button"
        onClick={() => nessoStore.setView(view.id)}
        aria-current={workspace.activeViewId === view.id ? 'page' : undefined}
        className="min-w-0 flex-1 rounded-sm px-2.5 py-2 text-left"
      >
        <span className="block text-[13px] leading-[19px] break-words">{view.name}</span>
        <span className="mt-[3px] block font-mono text-[10px] leading-[14px] text-muted-foreground">{view.conceptIds.length} {view.conceptIds.length === 1 ? 'concept' : 'concepts'}</span>
      </button>
      <Menu.Root open={menu === view.id} onOpenChange={(open) => setMenu(open ? view.id : null)}>
        <Menu.Trigger ref={(element: HTMLButtonElement | null) => {
          if (element) menuTriggers.current.set(view.id, element)
          else menuTriggers.current.delete(view.id)
        }} render={<Button variant="ghost" size="icon-sm" className="mr-1 text-muted-foreground opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 data-popup-open:opacity-100 hover:bg-transparent hover:text-foreground active:bg-transparent [@media(pointer:coarse)]:opacity-100" aria-label={`Actions for ${view.name}`} />}>
          <MoreHorizontal />
        </Menu.Trigger>
        <MenuPopup>
          <MenuItem onClick={() => {
            renamingId.current = view.id
            setRenaming(view)
          }}>Rename view</MenuItem>
          <MenuItem onClick={() => {
            host.store.setViewPinned(view.id, !view.pinned)
            requestAnimationFrame(() => {
              const trigger = menuTriggers.current.get(view.id)
              const target = trigger?.getClientRects().length ? trigger : createTrigger.current
              target?.focus()
            })
          }}>{view.pinned ? 'Unpin view' : 'Pin view'}</MenuItem>
          <MenuItem onClick={() => downloadGraph(host.store.getViewGraph(view.id), view.name)}>Export view</MenuItem>
          <Menu.Separator className="my-1 h-px bg-border" />
          <MenuItem onClick={() => { deletingId.current = view.id; setDeleting(view) }}>Delete view</MenuItem>
        </MenuPopup>
      </Menu.Root>
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

  return (
    <>
      <Sidebar>
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-5">
          <NewViewButton ref={createTrigger} />
          {heading('Pinned views', 'pinned-views', pinnedOpen, () => host.store.setSectionOpen('sidebar.pinned-views', !pinnedOpen))}
          <div className="explorer-scroll min-h-0 flex-1 overflow-y-auto p-1.5 -mx-1.5" onScroll={() => setMenu(null)}>
            <div id="pinned-views" hidden={!pinnedOpen} className="mt-1 space-y-0.5">
              <button type="button" onClick={() => nessoStore.setView(null)} aria-current={workspace.activeViewId === null ? 'page' : undefined} className="min-h-14 w-full shrink-0 rounded-sm px-2.5 py-2 text-left hover:bg-accent aria-[current=page]:bg-pressed">
                <span className="block text-[13px] leading-[19px]">Complete graph</span>
                <span className="mt-[3px] block font-mono text-[10px] leading-[14px] text-muted-foreground">Default</span>
              </button>
              {pinned.map(row)}
            </div>
            <div className="mt-4">
              {heading('Views', 'saved-views', viewsOpen, () => host.store.setSectionOpen('sidebar.views', !viewsOpen))}
              <div id="saved-views" hidden={!viewsOpen} className="mt-1 space-y-0.5">{ordinary.map(row)}</div>
            </div>
          </div>
        </div>
        <ResizeHandle onPointerDown={startResize} aria-label="Resize sidebar" className="absolute inset-y-0 right-0 z-20 cursor-col-resize bg-transparent" />
      </Sidebar>
      <Dialog.Root open={renaming !== null} onOpenChange={(open) => { if (!open) setRenaming(null) }}>
        <DialogPopup finalFocus={() => menuTriggers.current.get(renamingId.current ?? '') ?? createTrigger.current}>
          <Dialog.Title className="text-sm">Rename view</Dialog.Title>
          <Dialog.Description className="mt-2 text-xs text-muted-foreground">Only the name changes. Concepts and relations remain untouched.</Dialog.Description>
          {renaming && <ViewNameForm initialName={renaming.name} submitLabel="Save name" onSubmit={(name) => {
            host.store.renameView(renaming.id, name)
            setRenaming(null)
          }} />}
        </DialogPopup>
      </Dialog.Root>
      <Dialog.Root open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null) }}>
        <DialogPopup initialFocus={cancel} finalFocus={() => menuTriggers.current.get(deletingId.current ?? '') ?? createTrigger.current}>
          <Dialog.Title className="text-sm">Delete “{deleting?.name}”?</Dialog.Title>
          <Dialog.Description className="mt-2 text-xs text-muted-foreground">Concepts and relations remain untouched. This only deletes the view.</Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close render={<Button ref={cancel} variant="outline" />}>Cancel</Dialog.Close>
            <Button onClick={() => { if (deleting) host.store.deleteView(deleting.id); setDeleting(null) }}>Delete view</Button>
          </div>
        </DialogPopup>
      </Dialog.Root>
    </>
  )
}
