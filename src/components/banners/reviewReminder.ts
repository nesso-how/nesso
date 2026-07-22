// SPDX-License-Identifier: MIT
import type { Node } from '@xyflow/react'
import type { ConceptNodeData } from '@nesso-how/vocab-learning'

interface ReviewReminderEligibilityInput {
  nodes: Node<ConceptNodeData>[]
  graphId: string
  reviewEnabled: boolean
  reviewReminderEnabled: boolean
  lastShownByGraph: Record<string, string>
  onboardingActive: boolean
  now: Date
}

export function localDayKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function studiedDueCount(nodes: Node<ConceptNodeData>[], nowMs: number): number {
  return nodes.filter((node) => node.data.reps > 0 && node.data.due <= nowMs).length
}

export function getReviewReminderEligibility({
  nodes,
  graphId,
  reviewEnabled,
  reviewReminderEnabled,
  lastShownByGraph,
  onboardingActive,
  now,
}: ReviewReminderEligibilityInput): {
  eligible: boolean
  dueCount: number
  localDay: string
} {
  const localDay = localDayKey(now)
  const dueCount = studiedDueCount(nodes, now.getTime())
  return {
    eligible:
      reviewEnabled &&
      reviewReminderEnabled &&
      !onboardingActive &&
      dueCount > 0 &&
      lastShownByGraph[graphId] !== localDay,
    dueCount,
    localDay,
  }
}
