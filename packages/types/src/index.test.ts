// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import {
  defaultConceptReviewFields,
  defaultGraphDisplay,
  mergeGraphDisplay,
  nodeToCard,
  type ConceptNodeData,
  type NessoSettings,
} from './index.js'

describe('defaultConceptReviewFields', () => {
  it('returns zeroed FSRS fields for a fresh concept', () => {
    expect(defaultConceptReviewFields()).toEqual({
      stability: 0,
      difficulty: 0,
      reps: 0,
      lapses: 0,
      fsrsState: 0,
      due: 0,
      lastReview: 0,
      lastRating: 0,
      learningSteps: 0,
    })
  })

  it('returns a fresh object each call (no shared mutable reference)', () => {
    const a = defaultConceptReviewFields()
    const b = defaultConceptReviewFields()
    expect(a).not.toBe(b)
  })
})

describe('defaultGraphDisplay', () => {
  it('falls back to defaults when no settings are provided', () => {
    expect(defaultGraphDisplay()).toEqual({
      edgeEncoding: 'full',
      showHeatmap: true,
      curveStyle: 'arc',
      autoCurveFlip: true,
    })
  })

  it('reads values from the provided settings', () => {
    expect(
      defaultGraphDisplay({
        edgeEncoding: 'minimal',
        showHeatmap: false,
        curveStyle: 'straight',
        autoCurveFlip: false,
      }),
    ).toEqual({
      edgeEncoding: 'minimal',
      showHeatmap: false,
      curveStyle: 'straight',
      autoCurveFlip: false,
    })
  })
})

describe('mergeGraphDisplay', () => {
  const settings = {
    edgeEncoding: 'category',
    showHeatmap: false,
    curveStyle: 'straight',
    autoCurveFlip: true,
  } as NessoSettings

  it('uses settings-derived defaults when nothing is stored', () => {
    expect(mergeGraphDisplay(undefined, settings)).toEqual({
      edgeEncoding: 'category',
      showHeatmap: false,
      curveStyle: 'straight',
      autoCurveFlip: true,
    })
  })

  it('lets a partial stored display override individual fields', () => {
    expect(mergeGraphDisplay({ edgeEncoding: 'full' }, settings)).toMatchObject({
      edgeEncoding: 'full',
      showHeatmap: false,
      curveStyle: 'straight',
    })
  })

  it('preserves a stored autoCurveFlip of false rather than falling back to true', () => {
    expect(mergeGraphDisplay({ autoCurveFlip: false }, settings).autoCurveFlip).toBe(false)
  })
})

describe('nodeToCard', () => {
  const base: ConceptNodeData = {
    text: 'concept',
    ...defaultConceptReviewFields(),
  }

  it('maps persisted fields onto a ts-fsrs Card', () => {
    const card = nodeToCard({
      ...base,
      stability: 12,
      difficulty: 5,
      reps: 3,
      lapses: 1,
      fsrsState: 2,
      due: 1_000,
      lastReview: 500,
      learningSteps: 2,
    })
    expect(card.stability).toBe(12)
    expect(card.difficulty).toBe(5)
    expect(card.reps).toBe(3)
    expect(card.lapses).toBe(1)
    expect(card.state).toBe(2)
    expect(card.learning_steps).toBe(2)
    expect(card.due).toEqual(new Date(1_000))
    expect(card.last_review).toEqual(new Date(500))
  })

  it('treats due=0 as due-now and lastReview=0 as never reviewed', () => {
    const card = nodeToCard(base)
    expect(card.last_review).toBeUndefined()
    expect(card.due).toBeInstanceOf(Date)
  })

  it('defaults learning_steps to 0 when the field is absent', () => {
    const { learningSteps: _omit, ...withoutStep } = base
    expect(nodeToCard(withoutStep).learning_steps).toBe(0)
  })
})
