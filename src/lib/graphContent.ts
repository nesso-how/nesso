// SPDX-License-Identifier: MIT
import type { Node } from '@xyflow/react'
import type { ConceptNodeData, LearningNodeParams } from '@/types/graph'
import { defaultConceptReviewFields } from '@/types/graph'

export function extractReviewParams(data: ConceptNodeData): LearningNodeParams {
  const out: LearningNodeParams = {
    stability: data.stability,
    difficulty: data.difficulty,
    reps: data.reps,
    lapses: data.lapses,
    fsrsState: data.fsrsState,
    due: data.due,
    lastReview: data.lastReview,
    lastRating: data.lastRating,
  }
  if (data.learningSteps !== undefined) out.learningSteps = data.learningSteps
  return out
}

export function mergeReviewIntoNode(
  node: Node<ConceptNodeData>,
  review: LearningNodeParams | undefined,
): Node<ConceptNodeData> {
  const defaults = defaultConceptReviewFields()
  return {
    ...node,
    data: {
      ...defaults,
      ...(review ?? {}),
      text: node.data.text,
      ...(node.data.elaboration !== undefined && { elaboration: node.data.elaboration }),
    },
  }
}

export function nodeContentFingerprintData(data: ConceptNodeData): Record<string, unknown> {
  const { text, elaboration } = data
  return elaboration !== undefined ? { text, elaboration } : { text }
}
