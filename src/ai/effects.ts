import { aiRewriteApprovalThreshold, type AiEffects } from '@nesso/ai'
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
  const addedConcepts = new Set(delta.concepts.filter(({ before, after }) => !before && after).map(({ id }) => id))
  const rewrittenMemberships = updatedViews.reduce((total, view) => total + view.members.filter((member) => member.before || !addedConcepts.has(member.id)).length, 0)
  const counts = Object.values(groups)
  return {
    ...groups, memberships,
    requiresApproval: groups.concepts.removed + groups.relations.removed + groups.views.removed > 0
      || counts.reduce((total, group) => total + group.updated, rewrittenMemberships) > aiRewriteApprovalThreshold,
  }
}
