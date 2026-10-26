import { ArrowRight, BookOpen, ClipboardPaste, Copy, Download, FileDown, FileUp, Folder, Globe, Layers, Pencil, Play, Plus, RefreshCw, Scissors, Search, Share2, Sparkles, Upload, Zap, type LucideIcon } from 'lucide-react'
import type { ComponentProps } from 'react'

const icons = {
  'arrow-right': ArrowRight,
  'book-open': BookOpen,
  'clipboard-paste': ClipboardPaste,
  copy: Copy,
  download: Download,
  'file-down': FileDown,
  'file-up': FileUp,
  folder: Folder,
  globe: Globe,
  layers: Layers,
  pencil: Pencil,
  play: Play,
  plus: Plus,
  refresh: RefreshCw,
  scissors: Scissors,
  search: Search,
  share: Share2,
  sparkles: Sparkles,
  upload: Upload,
  zap: Zap,
} as const satisfies Record<string, LucideIcon>

export type ActionIconName = keyof typeof icons

export function ActionIcon({ name, ...props }: { name?: string } & ComponentProps<typeof Zap>) {
  const Icon = (name !== undefined ? icons[name as ActionIconName] : undefined) ?? Zap
  return <Icon aria-hidden="true" {...props} />
}
