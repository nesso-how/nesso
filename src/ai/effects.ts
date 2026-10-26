import { type AiChatMessage, type AiEffects } from '@nesso-how/ai'
import type { Change } from '../store/delta.ts'
import type { applyStateOperations } from '../store/operations.ts'

const count = <T>(changes: readonly Change<T>[]): AiEffects['concepts'] => ({
  added: changes.filter(({ before, after }) => !before && after).length,
  updated: changes.filter(({ before, after }) => before && after).length,
  removed: changes.filter(({ before, after }) => before && !after).length,
})

export function summarizeEffects({ delta, relationRewrites }: ReturnType<typeof applyStateOperations>): AiEffects {
  const before = new Set(relationRewrites.map((rewrite) => rewrite.before))
  const after = new Set(relationRewrites.map((rewrite) => rewrite.after))
  const relations = count(delta.relations.filter((change) => !before.has(change.id) && !after.has(change.id)))
  const groups = {
    concepts: count(delta.concepts),
    relations: { ...relations, updated: relations.updated + relationRewrites.length },
    relationTypes: count(delta.relationTypes),
    views: count(delta.views),
  }
  const updatedViews = delta.views.filter((view) => view.before && view.after)
  const memberships = updatedViews.reduce((total, view) => total + view.members.length, 0)
  return { ...groups, memberships }
}

export function summarizeCounts(effects: AiEffects): NonNullable<AiChatMessage['summary']> {
  const groups = [effects.concepts, effects.relations, effects.relationTypes, effects.views]
  return {
    added: groups.reduce((total, group) => total + group.added, 0),
    updated: groups.reduce((total, group) => total + group.updated, 0),
    removed: groups.reduce((total, group) => total + group.removed, 0),
    memberships: effects.memberships,
  }
}
