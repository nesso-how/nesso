import type { WorkspaceMap } from '@nesso-how/core'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { HostStore } from '../../store/types.ts'

function createVisibility() {
  return createStore(() => new Set<string>())
}

const stores = new WeakMap<HostStore, ReturnType<typeof createVisibility>>()

export function useGroupVisibility(host: HostStore) {
  let visibility = stores.get(host)
  if (!visibility) {
    visibility = createVisibility()
    stores.set(host, visibility)
  }
  const store = visibility
  const hidden = useStore(store)
  const toggle = (id: string) => store.setState((previous) => {
    const next = new Set(previous)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }, true)
  return [hidden, toggle] as const
}

export function hiddenConcepts(maps: readonly WorkspaceMap[], hidden: ReadonlySet<string>) {
  const excluded = new Set<string>()
  if (!hidden.size) return excluded
  const visible = new Set<string>()
  for (const map of maps) {
    const ids = map.groupId && hidden.has(map.groupId) ? excluded : visible
    for (const member of map.members) ids.add(member.id)
  }
  for (const id of visible) excluded.delete(id)
  return excluded
}
