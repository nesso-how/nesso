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
  ArrowDown,
  ArrowUp,
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
import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Sidebar } from './SidebarLayout'
import { NewMapButton } from './NewMapButton'
import { DeleteMapDialog } from './DeleteMapDialog'
import { nessoStore, useNessoStore } from '@/store'
import { hiddenConceptIds } from '@/store/operations'
import { maxMapNameLength } from '@/store/settings'
import type { HostStore } from '@/store/types'
import { useTranslation } from '@/i18n'
import { mapSections } from './map-sections'
import { MapGroupDialog, type MapGroupEdit } from './MapGroupDialog'
import { useMapDrag, type MapDrag, type MapDrop } from './map-drag'

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
  const conceptCount = useNessoStore(
    (state) =>
      state.workspace.activeMapId === null
        ? state.mapGraph.concepts.length
        : state.graph.concepts.length -
          hiddenConceptIds(state.workspace.maps, state.hiddenMapGroupIds).size,
    store,
  )
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
  const scroller = useRef<HTMLDivElement>(null)
  const { pinned, groups, ungrouped } = mapSections(workspace, workspace.maps)
  const place = (item: MapDrag, { groupId, beforeId }: Pick<MapDrop, 'groupId' | 'beforeId'>) => {
    setMenu(null)
    store.applyOperations([
      item.kind === 'pin'
        ? { kind: 'map.pin.move', id: item.id, beforeId }
        : item.kind === 'group'
          ? { kind: 'map-group.move', id: item.id, beforeId }
          : { kind: 'map.move', id: item.id, groupId, beforeId },
    ])
  }
  const { drag, drop, start } = useMapDrag(scroller, place)
  const dropTarget = (key: string, item?: MapDrag) => ({
    'data-drop-key': key,
    'data-drop': drop?.key === key ? drop.position : undefined,
    'data-dragging': item && drag?.kind === item.kind && drag.id === item.id ? '' : undefined,
  })

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
  const reorderItems = (
    siblings: readonly { id: string }[],
    item: MapDrag,
    key: string,
    groupId: string | null = null,
  ) => {
    const index = siblings.findIndex(({ id }) => id === item.id)
    const reorder = (beforeId: string | null) => {
      place(item, { groupId, beforeId })
      requestAnimationFrame(() => visibleTrigger(key)?.focus())
    }
    return (
      <>
        {index > 0 && (
          <MenuItem onClick={() => reorder(siblings[index - 1].id)}>
            <ArrowUp />
            {t('moveUp')}
          </MenuItem>
        )}
        {index < siblings.length - 1 && (
          <MenuItem onClick={() => reorder(siblings[index + 2]?.id ?? null)}>
            <ArrowDown />
            {t('moveDown')}
          </MenuItem>
        )}
      </>
    )
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

  const row = (map: WorkspaceMap, siblings: readonly WorkspaceMap[], shortcut = false) => {
    const key = mapKey(map.id, shortcut)
    const isPinned = workspace.pinnedMapIds.includes(map.id)
    const item: MapDrag = { kind: shortcut ? 'pin' : 'map', id: map.id }
    return (
      <ListRow
        key={map.id}
        className="map-drop has-[[aria-current]]:bg-pressed"
        data-map-row={map.id}
        {...dropTarget(key, item)}
      >
        <ListRowButton
          onClick={() => navigate(map.id)}
          onPointerDown={(event) => !readonly && start(event, item)}
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
                store.setMapPinned(map.id, !isPinned)
                restoreMapFocus(map.id, shortcut, map.groupId)
              }}
            >
              {isPinned ? <PinOff /> : <Pin />}
              {t(isPinned ? 'unpinMap' : 'pinMap')}
            </MenuItem>
            {reorderItems(siblings, item, key, map.groupId)}
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

  const heading = (
    label: string,
    id: string,
    open: boolean,
    toggle: () => void,
    onPointerDown?: (event: PointerEvent<HTMLElement>) => void,
  ) => (
    <SectionHeading
      open={open}
      className="min-h-8 min-w-0"
      aria-controls={id}
      onClick={toggle}
      onPointerDown={onPointerDown}
    >
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
          ref={scroller}
          className="nesso-scroll min-h-0 flex-1 overflow-y-auto p-1.5 -mx-1.5"
          data-map-dragging={drag ? '' : undefined}
          onScroll={() => setMenu(null)}
        >
          {pinned.length > 0 && (
            <div className="mb-4" data-map-section="pinned">
              {heading(t('pinnedMaps'), `${sectionId}-pinned`, pinnedOpen, () =>
                store.setSectionOpen('sidebar.pinned-maps', !pinnedOpen),
              )}
              <div id={`${sectionId}-pinned`} hidden={!pinnedOpen} className="mt-1 space-y-0.5">
                {pinned.map((map) => row(map, pinned, true))}
              </div>
            </div>
          )}
          {groups.map((group, index) => {
            const open = !workspace.collapsedMapGroupIds?.includes(group.id)
            const id = `${sectionId}-group-${index}`
            const item: MapDrag = { kind: 'group', id: group.id }
            return (
              <div
                key={group.id}
                className="map-drop mb-4"
                data-map-section="group"
                data-id={group.id}
                {...dropTarget(groupKey(group.id), item)}
              >
                <div className="group grid grid-cols-[minmax(0,1fr)_auto] items-center">
                  {heading(
                    group.name,
                    id,
                    open,
                    () =>
                      store.applyOperations([
                        { kind: 'map-group.setOpen', id: group.id, open: !open },
                      ]),
                    (event) => !readonly && start(event, item),
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
                      {reorderItems(groups, item, groupKey(group.id))}
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
                    group.maps.map((map) => row(map, group.maps))
                  ) : (
                    <p className="px-2.5 py-1 text-xs text-muted-foreground">
                      {t('noMapsInGroup')}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
          {(!groups.length || ungrouped.length > 0 || drag?.kind === 'map') && (
            <div className="map-drop" data-map-section="ungrouped" {...dropTarget('ungrouped')}>
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
                {ungrouped.map((map) => row(map, ungrouped))}
              </div>
            </div>
          )}
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
