import type { WorkspaceMap } from '@nesso-how/core'
import {
  Button,
  IconButton,
  Kbd,
  ListRow,
  ListRowButton,
  ListRowDetail,
  ListRowTitle,
  Menu,
  MenuItem,
  MenuPopup,
  RevealActions,
  SectionHeading,
  TextPromptDialog,
} from '@nesso-how/ui'
import { MoreHorizontal, Pencil, Pin, PinOff, Search, Settings2, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Sidebar } from './SidebarLayout'
import { NewMapButton } from './NewMapButton'
import { DeleteMapDialog } from './DeleteMapDialog'
import { host, nessoStore, useNessoStore } from '@/store'
import { maxMapNameLength } from '@/store/settings'
import type { HostStore } from '@/store/types'
import { useTranslation } from '@/i18n'

export function AppSidebar({
  store = nessoStore,
  readonly = false,
  bare = false,
  onNavigate,
  onOpenSettings,
  onOpenSearch,
}: {
  store?: HostStore
  readonly?: boolean
  bare?: boolean
  onNavigate?: () => void
  onOpenSettings?: () => void
  onOpenSearch?: () => void
}) {
  const t = useTranslation(store)
  const workspace = useNessoStore((state) => state.workspace, store)
  const conceptCount = useNessoStore((state) => state.graph.concepts.length, store)
  const collapsed = useNessoStore((state) => state.preferences.collapsedSections, store)
  const pinnedOpen = !collapsed?.includes('sidebar.pinned-maps')
  const mapsOpen = !collapsed?.includes('sidebar.maps')
  const [deleting, setDeleting] = useState<WorkspaceMap | null>(null)
  const [renaming, setRenaming] = useState<WorkspaceMap | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const createTrigger = useRef<HTMLButtonElement>(null)
  const menuTriggers = useRef(new Map<string, HTMLButtonElement>())
  const deletingId = useRef<string | null>(null)
  const renamingId = useRef<string | null>(null)
  const pinned = workspace.maps.filter((map) => map.pinned)
  const ordinary = workspace.maps.filter((map) => !map.pinned)

  useEffect(() => {
    const close = () => setMenu(null)
    window.addEventListener('resize', close)
    return () => window.removeEventListener('resize', close)
  }, [])

  const navigate = (mapId: string | null) => {
    store.setMap(mapId)
    onNavigate?.()
  }

  const row = (map: WorkspaceMap) => (
    <ListRow key={map.id} className="has-[[aria-current]]:bg-pressed">
      <ListRowButton
        onClick={() => navigate(map.id)}
        aria-current={workspace.activeMapId === map.id ? 'page' : undefined}
      >
        <ListRowTitle>{map.name}</ListRowTitle>
        <ListRowDetail>{t('conceptCount', { count: map.members.length })}</ListRowDetail>
      </ListRowButton>
      <RevealActions className="mr-1">
        <Menu.Root open={menu === map.id} onOpenChange={(open) => setMenu(open ? map.id : null)}>
          <Menu.Trigger
            disabled={readonly}
            ref={(element: HTMLButtonElement | null) => {
              if (element) menuTriggers.current.set(map.id, element)
              else menuTriggers.current.delete(map.id)
            }}
            render={<IconButton aria-label={t('actionsFor', { name: map.name })} />}
          >
            <MoreHorizontal />
          </Menu.Trigger>
          <MenuPopup>
            <MenuItem
              onClick={() => {
                renamingId.current = map.id
                setRenaming(map)
              }}
            >
              <Pencil />
              {t('renameMap')}
            </MenuItem>
            <MenuItem
              onClick={() => {
                host.store.setMapPinned(map.id, !map.pinned)
                requestAnimationFrame(() => {
                  const trigger = menuTriggers.current.get(map.id)
                  const target = trigger?.getClientRects().length ? trigger : createTrigger.current
                  target?.focus()
                })
              }}
            >
              {map.pinned ? <PinOff /> : <Pin />}
              {t(map.pinned ? 'unpinMap' : 'pinMap')}
            </MenuItem>
            <Menu.Separator className="my-1 h-px bg-border" />
            <MenuItem
              onClick={() => {
                deletingId.current = map.id
                setDeleting(map)
              }}
            >
              <Trash2 />
              {t('deleteMap')}
            </MenuItem>
          </MenuPopup>
        </Menu.Root>
      </RevealActions>
    </ListRow>
  )

  const heading = (label: string, id: string, open: boolean, toggle: () => void) => (
    <SectionHeading open={open} className="min-h-8" aria-controls={id} onClick={toggle}>
      {label}
    </SectionHeading>
  )

  const content = (
    <>
      <div className="flex min-h-0 flex-1 flex-col px-3 pt-2">
        {onOpenSearch && (
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={onOpenSearch}
            aria-keyshortcuts="Meta+K Control+K"
          >
            <Search />
            {t('search')}
            <Kbd className="ml-auto h-5 min-w-0 border-transparent px-1 text-[9px]">
              {/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'} K
            </Kbd>
          </Button>
        )}
        <NewMapButton ref={createTrigger} disabled={readonly} />
        <div aria-hidden className="my-2 h-px bg-border" />
        <ListRow className="has-[[aria-current]]:bg-pressed">
          <ListRowButton
            onClick={() => navigate(null)}
            aria-current={workspace.activeMapId === null ? 'page' : undefined}
          >
            <ListRowTitle>{t('completeGraph')}</ListRowTitle>
            <ListRowDetail>{t('conceptCount', { count: conceptCount })}</ListRowDetail>
          </ListRowButton>
        </ListRow>
        <div
          className="nesso-scroll min-h-0 flex-1 overflow-y-auto p-1.5 -mx-1.5"
          onScroll={() => setMenu(null)}
        >
          {pinned.length > 0 && (
            <div className="mb-4">
              {heading(t('pinnedMaps'), 'pinned-maps', pinnedOpen, () =>
                store.setSectionOpen('sidebar.pinned-maps', !pinnedOpen),
              )}
              <div id="pinned-maps" hidden={!pinnedOpen} className="mt-1 space-y-0.5">
                {pinned.map(row)}
              </div>
            </div>
          )}
          <div>
            {heading(t('maps'), 'maps', mapsOpen, () =>
              store.setSectionOpen('sidebar.maps', !mapsOpen),
            )}
            <div id="maps" hidden={!mapsOpen} className="sidebar-maps mt-1 space-y-0.5">
              {ordinary.map(row)}
            </div>
          </div>
        </div>
      </div>
      {(onOpenSettings || readonly) && (
        <div className="shrink-0 px-3 py-2">
          <div aria-hidden className="mb-2 h-px bg-border" />
          <Button
            data-settings-trigger
            disabled={readonly}
            variant="ghost"
            className="w-full justify-start"
            onClick={onOpenSettings}
          >
            <Settings2 />
            {t('settings')}
          </Button>
        </div>
      )}
    </>
  )

  return (
    <>
      {bare ? content : <Sidebar>{content}</Sidebar>}
      {!readonly && (
        <TextPromptDialog
          open={renaming !== null}
          onOpenChange={(open) => {
            if (!open) setRenaming(null)
          }}
          title={t('renameMap')}
          description={t('renameDescription')}
          initialValue={renaming?.name ?? ''}
          nameLabel={t('name')}
          submitLabel={t('saveName')}
          cancelLabel={t('cancel')}
          maxLength={maxMapNameLength}
          finalFocus={() =>
            menuTriggers.current.get(renamingId.current ?? '') ?? createTrigger.current
          }
          onSubmit={(name) => {
            if (renaming) host.store.renameMap(renaming.id, name)
            setRenaming(null)
          }}
        />
      )}
      {!readonly && (
        <DeleteMapDialog
          target={deleting}
          onClose={() => setDeleting(null)}
          finalFocus={() =>
            menuTriggers.current.get(deletingId.current ?? '') ?? createTrigger.current
          }
        />
      )}
    </>
  )
}
