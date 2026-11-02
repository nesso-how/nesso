import type { AiChatMessage } from './chat.ts'
import type { AiEffects } from './results.ts'

export function summarizeAiEffects(effects: AiEffects): NonNullable<AiChatMessage['summary']> {
  const groups = [effects.concepts, effects.relations, effects.relationTypes, effects.views]
  return {
    added: groups.reduce((total, group) => total + group.added, 0),
    updated: groups.reduce((total, group) => total + group.updated, 0),
    removed: groups.reduce((total, group) => total + group.removed, 0),
    memberships: effects.memberships,
  }
}

export function hasAiEffects(effects: AiEffects): boolean {
  return (
    effects.memberships > 0 ||
    [effects.concepts, effects.relations, effects.relationTypes, effects.views].some(
      (group) => group.added + group.updated + group.removed > 0,
    )
  )
}
