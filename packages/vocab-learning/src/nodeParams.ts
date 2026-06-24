// SPDX-License-Identifier: MIT
//
// Runtime concept node fields: shared content plus per-user FSRS review state.
// `ConceptNodeData` is the in-app shape; only `text`/`elaboration` serialize to
// graph JSON — FSRS lives in the app's review store, not in the shared file.
import type { ConceptElaboration } from './graphDocument.js'

/** Private dynamic node parameters declared by the Nesso Learning Vocabulary. */
export interface LearningNodeParams extends Record<string, unknown> {
  stability: number
  difficulty: number
  reps: number
  lapses: number
  /** ts-fsrs State: 0=New 1=Learning 2=Review 3=Relearning */
  fsrsState: number
  /** Unix ms; due when <= now (0 = new / immediate). */
  due: number
  /** Unix ms; 0 = never reviewed. */
  lastReview: number
  /** 0=unrated, 1=Again 2=Hard 3=Good 4=Easy (matches ts-fsrs Rating). */
  lastRating: number
  /** FSRS learning-step index; optional for records saved before it existed. */
  learningSteps?: number
}

/** Fresh private params for a new or shared-import concept (no personal review history). */
export function defaultConceptReviewFields(): LearningNodeParams {
  return {
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    fsrsState: 0,
    due: 0,
    lastReview: 0,
    lastRating: 0,
    learningSteps: 0,
  }
}

/** Runtime node payload: shared content plus per-user FSRS fields (not in graph documents). */
export interface ConceptNodeData extends LearningNodeParams {
  text: string
  elaboration?: ConceptElaboration
}
