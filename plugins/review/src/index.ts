import type { ActionContribution } from '@nesso-how/plugin'
import { ReviewPanel } from './ui/panel.tsx'

export const create = (): readonly ActionContribution[] => [
  {
    id: 'review-view',
    label: { en: 'Review', it: 'Ripasso', 'zh-CN': '复习' },
    icon: 'glasses',
    ui: ReviewPanel,
  },
]
