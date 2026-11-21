import type { WorkspaceMap, WorkspaceState } from '@nesso-how/core'

export function mapSections({ mapGroups }: WorkspaceState, maps: readonly WorkspaceMap[]) {
  const pinned: WorkspaceMap[] = []
  const ungrouped: WorkspaceMap[] = []
  const groups = mapGroups.map((group) => ({ ...group, maps: [] as WorkspaceMap[] }))
  const byId = new Map(groups.map((group) => [group.id, group.maps]))
  for (const map of maps) {
    if (map.pinned) pinned.push(map)
    const section = byId.get(map.groupId ?? '') ?? ungrouped
    section.push(map)
  }
  return { pinned, groups, ungrouped }
}
