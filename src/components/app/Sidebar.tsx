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
  MenuRadioItem,
  MenuSubmenuTrigger,
  RevealActions,
  SectionHeading,
  TextPromptDialog,
} from '@nesso-how/ui'
import {
  ChevronRight,
  FolderInput,
  FolderMinus,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Search,
  Settings2,
  Trash2,
} from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Sidebar } from './SidebarLayout'
import { NewMapButton } from './NewMapButton'
import { DeleteMapDialog } from './DeleteMapDialog'
import { nessoStore, useNessoStore } from '@/store'
import { maxMapNameLength } from '@/store/settings'
import type { HostStore } from '@/store/types'
import { useTranslation } from '@/i18n'
import { mapSections } from './map-sections'
import { MapGroupDialog, type MapGroupEdit } from './MapGroupDialog'

const mapKey = (id: string, shortcut: boolean) => `${shortcut ? 'pinned-map' : 'map'}:${id}`
const groupKey = (id: string) => `group:${id}`

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
  const [groupEdit, setGroupEdit] = useState<MapGroupEdit | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const sectionId = useId()
  const createTrigger = useRef<HTMLButtonElement>(null)
  const createGroupTrigger = useRef<HTMLButtonElement>(null)
  const menuTriggers = useRef(new Map<string, HTMLButtonElement>())
  const deletingId = useRef<string | null>(null)
  const renamingId = useRef<string | null>(null)
  const groupDialogOrigin = useRef<string | null>(null)
  const { pinned, groups, ungrouped } = mapSections(workspace, workspace.maps)

  useEffect(() => {
    const close = () => setMenu(null)
    window.addEventListener('resize', close)
    return () => window.removeEventListener('resize', close)
  }, [])

  const navigate = (mapId: string | null) => {
    store.setMap(mapId)
    onNavigate?.()
  }

  const visibleTrigger = (key: string | null) => {
    const trigger = key === null ? null : menuTriggers.current.get(key)
    return trigger?.getClientRects().length ? trigger : null
  }
  const restoreMapFocus = (id: string, shortcut: boolean, groupId?: string | null) => {
    requestAnimationFrame(() =>
      (
        visibleTrigger(mapKey(id, shortcut)) ??
        visibleTrigger(mapKey(id, !shortcut)) ??
        (groupId ? visibleTrigger(groupKey(groupId)) : null) ??
        createTrigger.current
      )?.focus(),
    )
  }
  const moveMap = (map: WorkspaceMap, shortcut: boolean, groupId: string | null) => {
    if ((map.groupId ?? null) === groupId) return
    setMenu(null)
    store.applyOperations([{ kind: 'map.group', id: map.id, groupId }])
    restoreMapFocus(map.id, shortcut, groupId)
  }
  const editGroup = (edit: MapGroupEdit, origin: string | null = null) => {
    groupDialogOrigin.current = origin
    setGroupEdit(edit)
  }
  const actions = (key: string, label: string, items: ReactNode) =>
    !readonly && (
      <RevealActions className="mr-1">
        <Menu.Root
          open={menu === key}
          onOpenChange={(open) =>
            setMenu((current) => (open ? key : current === key ? null : current))
          }
        >
          <Menu.Trigger
            ref={(element: HTMLButtonElement | null) => {
              if (element) menuTriggers.current.set(key, element)
              else menuTriggers.current.delete(key)
            }}
            render={<IconButton aria-label={label} />}
          >
            <MoreHorizontal />
          </Menu.Trigger>
          <MenuPopup>{items}</MenuPopup>
        </Menu.Root>
      </RevealActions>
    )

  const row = (map: WorkspaceMap, shortcut: boolean) => {
    const key = mapKey(map.id, shortcut)
    return (
      <ListRow key={map.id} className="has-[[aria-current]]:bg-pressed">
        <ListRowButton
          onClick={() => navigate(map.id)}
          aria-current={workspace.activeMapId === map.id ? 'page' : undefined}
        >
          <ListRowTitle>{map.name}</ListRowTitle>
          <ListRowDetail>{t('conceptCount', { count: map.members.length })}</ListRowDetail>
        </ListRowButton>
        {actions(
          key,
          t('actionsFor', { name: map.name }),
          <>
            <MenuItem
              onClick={() => {
                renamingId.current = key
                setRenaming(map)
              }}
            >
              <Pencil />
              {t('renameMap')}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenu(null)
                store.setMapPinned(map.id, !map.pinned)
                restoreMapFocus(map.id, shortcut, map.groupId)
              }}
            >
              {map.pinned ? <PinOff /> : <Pin />}
              {t(map.pinned ? 'unpinMap' : 'pinMap')}
            </MenuItem>
            <Menu.SubmenuRoot>
              <MenuSubmenuTrigger>
                <FolderInput />
                {t('moveMapToGroup')}
                <ChevronRight className="ml-auto" />
              </MenuSubmenuTrigger>
              <MenuPopup side="right">
                <MenuItem onClick={() => editGroup({ kind: 'create', mapId: map.id }, key)}>
                  <FolderPlus />
                  {t('newMapGroup')}
                </MenuItem>
                {groups.length > 0 && <Menu.Separator className="my-1 h-px bg-border" />}
                <Menu.RadioGroup
                  value={map.groupId ?? ''}
                  onValueChange={(id) => moveMap(map, shortcut, id)}
                >
                  {groups.map((group) => (
                    <MenuRadioItem key={group.id} value={group.id}>
                      <span className="min-w-0 break-words">{group.name}</span>
                    </MenuRadioItem>
                  ))}
                </Menu.RadioGroup>
              </MenuPopup>
            </Menu.SubmenuRoot>
            {map.groupId !== undefined && (
              <MenuItem onClick={() => moveMap(map, shortcut, null)}>
                <FolderMinus />
                {t('removeMapFromGroup')}
              </MenuItem>
            )}
            <Menu.Separator className="my-1 h-px bg-border" />
            <MenuItem
              onClick={() => {
                deletingId.current = key
                setDeleting(map)
              }}
            >
              <Trash2 />
              {t('deleteMap')}
            </MenuItem>
          </>,
        )}
      </ListRow>
    )
  }

  const heading = (label: string, id: string, open: boolean, toggle: () => void) => (
    <SectionHeading open={open} className="min-h-8 min-w-0" aria-controls={id} onClick={toggle}>
      <span className="truncate" title={label}>
        {label}
      </span>
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
        {!readonly && (
          <Button
            ref={createGroupTrigger}
            variant="ghost"
            className="w-full justify-start"
            onClick={() => editGroup({ kind: 'create' })}
          >
            <FolderPlus />
            {t('newMapGroup')}
          </Button>
        )}
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
              {heading(t('pinnedMaps'), `${sectionId}-pinned`, pinnedOpen, () =>
                store.setSectionOpen('sidebar.pinned-maps', !pinnedOpen),
              )}
              <div id={`${sectionId}-pinned`} hidden={!pinnedOpen} className="mt-1 space-y-0.5">
                {pinned.map((map) => row(map, true))}
              </div>
            </div>
          )}
          {groups.map((group, index) => {
            const open = !workspace.collapsedMapGroupIds?.includes(group.id)
            const id = `${sectionId}-group-${index}`
            return (
              <div key={group.id} className="mb-4">
                <div className="group grid grid-cols-[minmax(0,1fr)_auto] items-center">
                  {heading(group.name, id, open, () =>
                    store.applyOperations([
                      { kind: 'map-group.setOpen', id: group.id, open: !open },
                    ]),
                  )}
                  {actions(
                    groupKey(group.id),
                    t('mapGroupActionsFor', { name: group.name }),
                    <>
                      <MenuItem
                        onClick={() => editGroup({ kind: 'rename', group }, groupKey(group.id))}
                      >
                        <Pencil />
                        {t('renameMapGroup')}
                      </MenuItem>
                      <MenuItem
                        onClick={() => editGroup({ kind: 'delete', group }, groupKey(group.id))}
                      >
                        <Trash2 />
                        {t('deleteMapGroup')}
                      </MenuItem>
                    </>,
                  )}
                </div>
                <div id={id} hidden={!open} className="mt-1 space-y-0.5">
                  {group.maps.length > 0 ? (
                    group.maps.map((map) => row(map, false))
                  ) : (
                    <p className="px-2.5 py-1 text-xs text-muted-foreground">
                      {t('noMapsInGroup')}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
          <div>
            {heading(
              t(groups.length ? 'ungroupedMaps' : 'maps'),
              `${sectionId}-maps`,
              mapsOpen,
              () => store.setSectionOpen('sidebar.maps', !mapsOpen),
            )}
            <div
              id={`${sectionId}-maps`}
              hidden={!mapsOpen}
              className="sidebar-maps mt-1 space-y-0.5"
            >
              {ungrouped.map((map) => row(map, false))}
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
          finalFocus={() => visibleTrigger(renamingId.current) ?? createTrigger.current}
          onSubmit={(name) => {
            if (renaming && store.getState().workspace.maps.some(({ id }) => id === renaming.id))
              store.renameMap(renaming.id, name)
            setRenaming(null)
          }}
        />
      )}
      {!readonly && (
        <DeleteMapDialog
          target={deleting}
          onClose={() => setDeleting(null)}
          finalFocus={() => visibleTrigger(deletingId.current) ?? createTrigger.current}
        />
      )}
      {!readonly && (
        <MapGroupDialog
          edit={groupEdit}
          store={store}
          onClose={() => setGroupEdit(null)}
          finalFocus={() => visibleTrigger(groupDialogOrigin.current) ?? createGroupTrigger.current}
        />
      )}
    </>
  )
}
