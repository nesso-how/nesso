// SPDX-License-Identifier: MIT
import { useEffect, useState } from 'react'
import { ActionBanner } from '@/components/banners/ActionBanner'
import { useT } from '@/i18n'
import { useGraphStore } from '@/store'
import { getReviewReminderEligibility } from './reviewReminder'

interface Props {
  onStartReview: () => void
  onboardingActive: boolean
}

interface VisibleReminder {
  graphId: string
  dueCount: number
}

export function ReviewReminderBanner({ onStartReview, onboardingActive }: Props) {
  const t = useT()
  const loadedToken = useGraphStore((state) => state.loadedToken)
  const currentGraphId = useGraphStore((state) => state.currentGraphId)
  const reviewEnabled = useGraphStore((state) => state.settings.reviewEnabled)
  const reviewReminderEnabled = useGraphStore((state) => state.settings.reviewReminderEnabled)
  const [visible, setVisible] = useState<VisibleReminder | null>(null)

  useEffect(() => {
    if (!reviewEnabled || !reviewReminderEnabled) setVisible(null)
  }, [reviewEnabled, reviewReminderEnabled])

  useEffect(() => {
    setVisible(null)
    if (loadedToken === 0 || onboardingActive) return

    const state = useGraphStore.getState()
    if (!state.settings.reviewEnabled || !state.settings.reviewReminderEnabled) return
    const result = getReviewReminderEligibility({
      nodes: state.nodes,
      graphId: state.currentGraphId,
      reviewEnabled: state.settings.reviewEnabled,
      reviewReminderEnabled: state.settings.reviewReminderEnabled,
      lastShownByGraph: state.reviewReminderLastShownByGraph,
      onboardingActive,
      now: new Date(),
    })
    if (!result.eligible) return

    state.markReviewReminderShown(state.currentGraphId, result.localDay)
    setVisible({ graphId: state.currentGraphId, dueCount: result.dueCount })
  }, [loadedToken, onboardingActive])

  if (!visible || !reviewEnabled || !reviewReminderEnabled || visible.graphId !== currentGraphId)
    return null

  return (
    <ActionBanner
      open
      message={t.review.reminder(visible.dueCount)}
      actions={[
        {
          label: t.review.startReview,
          primary: true,
          onClick: () => {
            setVisible(null)
            onStartReview()
          },
        },
      ]}
      onClose={() => setVisible(null)}
    />
  )
}
