import { Menu } from '@nesso-how/ui'
import type { WorkspaceMap, WorkspaceState } from '@nesso-how/core'
import type { ReactNode } from 'react'
import { useTranslation } from '@/i18n'
import { mapSections } from './map-sections'

export function MapMenuSections({
  workspace,
  maps = workspace.maps,
  renderMap,
  afterGraph = false,
}: {
  workspace: WorkspaceState
  maps?: readonly WorkspaceMap[]
  renderMap: (map: WorkspaceMap) => ReactNode
  afterGraph?: boolean
}) {
  const t = useTranslation()
  const { pinned, groups, ungrouped } = mapSections(workspace, maps)
  const sections = [
    { key: 'pinned', name: t('pinnedMaps'), maps: pinned },
    ...groups.map((group) => ({ ...group, key: `group:${group.id}` })),
    { key: 'ungrouped', name: t(groups.length ? 'ungroupedMaps' : 'maps'), maps: ungrouped },
  ].filter((section) => section.maps.length > 0)
  return sections.map((section, index) => (
    <Menu.Group key={section.key}>
      {(afterGraph || index > 0) && <Menu.Separator className="my-1 h-px bg-border" />}
      <Menu.GroupLabel className="px-2.5 pt-2 pb-1 font-mono text-[11px] leading-4 break-words text-muted-foreground">
        {section.name}
      </Menu.GroupLabel>
      {section.maps.map(renderMap)}
    </Menu.Group>
  ))
}
