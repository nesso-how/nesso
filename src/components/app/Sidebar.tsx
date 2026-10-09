import type { SavedView } from '@nesso/plugin'
import { defaultLocale } from '@nesso/i18n'
import { Button, IconButton, ListRow, ListRowButton, ListRowDetail, ListRowTitle, Menu, MenuItem, MenuPopup, RevealActions, SectionHeading, TextPromptDialog } from '@nesso/ui'
import { MoreHorizontal, Pencil, Pin, PinOff, Settings2, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Sidebar } from './SidebarLayout'
import { NewViewButton } from './NewViewButton'
import { DeleteViewDialog } from './DeleteViewDialog'
import { viewActions } from '@/plugins'
import { host, nessoStore, useNessoStore } from '@/store'
import { maxViewNameLength } from '@/store/settings'
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
    <ListRow key={view.id} className="has-[[aria-current]]:bg-pressed">
      <ListRowButton
        onClick={() => navigate(view.id)}
        aria-current={workspace.activeViewId === view.id ? 'page' : undefined}
      >
        <ListRowTitle>{view.name}</ListRowTitle>
        <ListRowDetail>{t('conceptCount', { count: view.conceptIds.length })}</ListRowDetail>
      </ListRowButton>
      {!readonly && (
        <RevealActions className="mr-1">
          <Menu.Root open={menu === view.id} onOpenChange={(open) => setMenu(open ? view.id : null)}>
          <Menu.Trigger ref={(element: HTMLButtonElement | null) => {
            if (element) menuTriggers.current.set(view.id, element)
            else menuTriggers.current.delete(view.id)
          }} render={<IconButton aria-label={t('actionsFor', { name: view.name })} />}>
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
        </RevealActions>
      )}
    </ListRow>
  )

  const heading = (label: string, id: string, open: boolean, toggle: () => void) => (
    <SectionHeading open={open} className="min-h-8" aria-controls={id} onClick={toggle}>{label}</SectionHeading>
  )

  const content = (
    <>
      <div className="flex min-h-0 flex-1 flex-col px-3 pt-5">
        {!readonly && <NewViewButton ref={createTrigger} />}
        {heading(t('pinnedViews'), 'pinned-views', pinnedOpen, () => host.store.setSectionOpen('sidebar.pinned-views', !pinnedOpen))}
        <div className="explorer-scroll min-h-0 flex-1 overflow-y-auto p-1.5 -mx-1.5" onScroll={() => setMenu(null)}>
          <div id="pinned-views" hidden={!pinnedOpen} className="mt-1 space-y-0.5">
            <ListRow className="has-[[aria-current]]:bg-pressed">
              <ListRowButton onClick={() => navigate(null)} aria-current={workspace.activeViewId === null ? 'page' : undefined}>
                <ListRowTitle>{t('completeGraph')}</ListRowTitle>
                <ListRowDetail>{t('conceptCount', { count: conceptCount })}</ListRowDetail>
              </ListRowButton>
              {!readonly && (
                <RevealActions className="mr-1">
                <Menu.Root open={menu === 'complete-graph'} onOpenChange={(open) => setMenu(open ? 'complete-graph' : null)}>
                  <Menu.Trigger ref={(element: HTMLButtonElement | null) => {
                    if (element) menuTriggers.current.set('complete-graph', element)
                    else menuTriggers.current.delete('complete-graph')
                  }} render={<IconButton aria-label={t('actionsFor', { name: t('completeGraph') })} />}>
                    <MoreHorizontal />
                  </Menu.Trigger>
                  <MenuPopup>
                    <ViewActionGroup viewId={null} />
                    <Menu.Separator className="my-1 h-px bg-border" />
                    <MenuItem onClick={() => { deletingId.current = 'complete-graph'; setDeleting('complete-graph') }}><Trash2 />{t('deleteView')}</MenuItem>
                  </MenuPopup>
                </Menu.Root>
                </RevealActions>
              )}
            </ListRow>
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
        </Sidebar>
      )}
      {!readonly && (
        <TextPromptDialog open={renaming !== null} onOpenChange={(open) => { if (!open) setRenaming(null) }} title={t('renameView')} description={t('renameDescription')} initialValue={renaming?.name ?? ''} nameLabel={t('name')} submitLabel={t('saveName')} cancelLabel={t('cancel')} maxLength={maxViewNameLength} finalFocus={() => menuTriggers.current.get(renamingId.current ?? '') ?? createTrigger.current} onSubmit={(name) => {
          if (renaming) host.store.renameView(renaming.id, name)
          setRenaming(null)
        }} />
      )}
      {!readonly && <DeleteViewDialog target={deleting} onClose={() => setDeleting(null)} finalFocus={() => menuTriggers.current.get(deletingId.current ?? '') ?? createTrigger.current} />}
    </>
  )
}
