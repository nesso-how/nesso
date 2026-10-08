import type { Change } from '../store/delta.ts'
import type { applyStateOperations } from '../store/operations.ts'

type Counts = { readonly added: number; readonly updated: number; readonly removed: number }
export type AiEffects = {
  readonly concepts: Counts
  readonly relations: Counts
  readonly relationTypes: Counts
  readonly views: Counts
  readonly memberships: number
  readonly reset: boolean
  readonly requiresApproval: boolean
}

const count = <T>(changes: readonly Change<T>[]): Counts => ({
  added: changes.filter(({ before, after }) => !before && after).length,
  updated: changes.filter(({ before, after }) => before && after).length,
  removed: changes.filter(({ before, after }) => before && !after).length,
})

export function summarizeEffects({ delta, reset, relationRewrites }: ReturnType<typeof applyStateOperations>): AiEffects {
  const before = new Set(relationRewrites.map((rewrite) => rewrite.before))
  const after = new Set(relationRewrites.map((rewrite) => rewrite.after))
  const relations = count(delta.relations.filter((change) => !before.has(change.id) && !after.has(change.id)))
  const groups = {
    concepts: count(delta.concepts),
    relations: { ...relations, updated: relations.updated + relationRewrites.length },
    relationTypes: count(delta.relationTypes),
    views: count(delta.views),
  }
  const memberships = delta.views.filter((view) => view.before && view.after).reduce((total, view) => total + view.members.length, 0)
  const addedConcepts = new Set(delta.concepts.filter(({ before, after }) => !before && after).map(({ id }) => id))
  const rewrittenMemberships = delta.views.filter((view) => view.before && view.after)
    .reduce((total, view) => total + view.members.filter((member) => member.before || !addedConcepts.has(member.id)).length, 0)
  const counts = Object.values(groups)
  return {
    ...groups, memberships, reset,
    requiresApproval: reset || groups.concepts.removed + groups.relations.removed + groups.views.removed > 0
      || counts.reduce((total, group) => total + group.updated, rewrittenMemberships) > 10,
  }
}
