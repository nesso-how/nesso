import type { ActionContribution } from '@nesso-how/plugin'
import { NotesPanel } from './panel.tsx'

export const create = (): readonly ActionContribution[] => [
  {
    id: 'notes',
    label: { en: 'Notes', it: 'Note', 'zh-CN': '笔记' },
    icon: 'pencil',
    ui: NotesPanel,
  },
]
