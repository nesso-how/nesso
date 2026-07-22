// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import type { ConceptNodeData } from '@nesso-how/vocab-learning'
import { getReviewReminderEligibility, localDayKey, studiedDueCount } from './reviewReminder'

const now = new Date(2026, 6, 22, 12, 0, 0)

function node(id: string, reps: number, due: number): Node<ConceptNodeData> {
  return {
    id,
    position: { x: 0, y: 0 },
    data: {
      text: id,
      definition: '',
      due,
      stability: 0,
      difficulty: 0,
      reps,
      lapses: 0,
      fsrsState: 0,
      lastReview: 0,
      lastRating: 0,
      learningSteps: 0,
    },
  }
}

const eligibleInput = {
  nodes: [node('studied', 1, now.getTime())],
  graphId: 'graph-a',
  reviewEnabled: true,
  reviewReminderEnabled: true,
  lastShownByGraph: {},
  onboardingActive: false,
  now,
}

describe('localDayKey', () => {
  it('uses local calendar fields with zero-padded month and day', () => {
    expect(localDayKey(new Date(2026, 0, 2, 23, 59))).toBe('2026-01-02')
  })
})

describe('studiedDueCount', () => {
  it('excludes new due cards and future reviewed cards', () => {
    expect(
      studiedDueCount(
        [node('new', 0, 0), node('due', 2, now.getTime()), node('future', 3, now.getTime() + 1)],
        now.getTime(),
      ),
    ).toBe(1)
  })
})

describe('getReviewReminderEligibility', () => {
  it('returns the studied due count and local day when eligible', () => {
    expect(getReviewReminderEligibility(eligibleInput)).toEqual({
      eligible: true,
      dueCount: 1,
      localDay: '2026-07-22',
    })
  })

  it.each([
    ['review mode is disabled', { reviewEnabled: false }],
    ['reminders are disabled', { reviewReminderEnabled: false }],
    ['onboarding or consent is active', { onboardingActive: true }],
    ['the graph was already shown today', { lastShownByGraph: { 'graph-a': '2026-07-22' } }],
    ['only new cards are due', { nodes: [node('new', 0, 0)] }],
  ])('is ineligible when %s', (_label, override) => {
    expect(getReviewReminderEligibility({ ...eligibleInput, ...override }).eligible).toBe(false)
  })

  it('keeps day state independent per graph', () => {
    expect(
      getReviewReminderEligibility({
        ...eligibleInput,
        graphId: 'graph-b',
        lastShownByGraph: { 'graph-a': '2026-07-22' },
      }).eligible,
    ).toBe(true)
  })

  it('becomes eligible on a later local day', () => {
    expect(
      getReviewReminderEligibility({
        ...eligibleInput,
        lastShownByGraph: { 'graph-a': '2026-07-21' },
      }).eligible,
    ).toBe(true)
  })
})
