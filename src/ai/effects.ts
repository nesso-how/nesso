import type { AiEffects } from '@nesso-how/ai'
import type { Change } from '../store/delta.ts'
import type { applyStateOperations } from '../store/operations.ts'

const count = <T>(changes: readonly Change<T>[]): AiEffects['concepts'] => ({
  added: changes.filter(({ before, after }) => !before && after).length,
  updated: changes.filter(({ before, after }) => before && after).length,
  removed: changes.filter(({ before, after }) => before && !after).length,
})

export function summarizeEffects({
  delta,
  relationRewrites,
}: ReturnType<typeof applyStateOperations>): AiEffects {
  const before = new Set(relationRewrites.map((rewrite) => rewrite.before))
  const after = new Set(relationRewrites.map((rewrite) => rewrite.after))
  const relations = count(
    delta.relations.filter((change) => !before.has(change.id) && !after.has(change.id)),
  )
  const maps = count(delta.maps)
  const changedMaps = new Set(delta.maps.map(({ id }) => id))
  const pins = delta.pinnedMapIds.filter(({ id }) => !changedMaps.has(id)).length
  const groups = {
    concepts: count(delta.concepts),
    relations: { ...relations, updated: relations.updated + relationRewrites.length },
    relationTypes: count(delta.relationTypes),
    maps: { ...maps, updated: maps.updated + pins },
    mapGroups: count(delta.mapGroups),
  }
  const updatedMaps = delta.maps.filter((map) => map.before && map.after)
  const memberships = updatedMaps.reduce((total, map) => total + map.members.length, 0)
  return { ...groups, memberships }
}
