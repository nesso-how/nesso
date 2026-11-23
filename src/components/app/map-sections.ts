import type { WorkspaceMap, WorkspaceState } from '@nesso-how/core'

export function mapSections(
  { mapGroups, pinnedMapIds }: WorkspaceState,
  maps: readonly WorkspaceMap[],
) {
  const ungrouped: WorkspaceMap[] = []
  const groups = mapGroups.map((group) => ({ ...group, maps: [] as WorkspaceMap[] }))
  const byId = new Map(groups.map((group) => [group.id, group.maps]))
  for (const map of maps) (byId.get(map.groupId ?? '') ?? ungrouped).push(map)
  const listed = new Map(maps.map((map) => [map.id, map]))
  const pinned = pinnedMapIds.flatMap((id) => listed.get(id) ?? [])
  return { pinned, groups, ungrouped }
}
