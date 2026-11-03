import type { ActionContribution } from '@nesso-how/plugin'
import { ReviewPanel } from './ui/panel.tsx'
import { reviewBadge } from './scheduler.ts'

export const create = (): readonly ActionContribution[] => [
  {
    id: 'review',
    label: { en: 'Review', it: 'Ripasso', 'zh-CN': '复习' },
    icon: 'repeat',
    ui: ReviewPanel,
    badge: reviewBadge,
  },
]
