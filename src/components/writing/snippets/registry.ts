// SPDX-License-Identifier: MIT
import type { Editor } from '@tiptap/core'
import type { Locale } from '@/i18n/registry'

// Extensible snippet registry — the designed extension point for Writing Mode.
// New snippets slot in here without refactoring; labels resolve through i18n so
// the registry itself stays locale-agnostic.

export interface SnippetDefinition {
  id: string
  label: string
  description: string
  icon: string
  command: (editor: Editor) => void
}

/** The locale string table `buildSnippets` resolves labels/descriptions from. */
export type SnippetStrings = Locale['writing']['snippets']

export function buildSnippets(t: SnippetStrings): SnippetDefinition[] {
  return [
    {
      id: 'heading-2',
      label: t.heading2,
      description: t.heading2Desc,
      icon: 'M5 5v14M12 5v14M5 12h7M16 12l3 7M19 12l-3 7',
      command: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      id: 'heading-3',
      label: t.heading3,
      description: t.heading3Desc,
      icon: 'M5 6v12M11 6v12M5 12h6M15 12l2.5 6M17.5 12L15 18',
      command: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      id: 'bullet-list',
      label: t.bulletList,
      description: t.bulletListDesc,
      icon: 'M4 6h.01M4 12h.01M4 18h.01M9 6h11M9 12h11M9 18h11',
      command: (e) => e.chain().focus().toggleBulletList().run(),
    },
    {
      id: 'ordered-list',
      label: t.orderedList,
      description: t.orderedListDesc,
      icon: 'M5 6h1v4M4 14h2v4H4M10 6h10M10 12h10M10 18h10',
      command: (e) => e.chain().focus().toggleOrderedList().run(),
    },
    {
      id: 'blockquote',
      label: t.blockquote,
      description: t.blockquoteDesc,
      icon: 'M7 7h4v6H7zM7 13c0 2 1 3 3 4M15 7h4v6h-4zM15 13c0 2 1 3 3 4',
      command: (e) => e.chain().focus().toggleBlockquote().run(),
    },
    {
      id: 'divider',
      label: t.divider,
      description: t.dividerDesc,
      icon: 'M3 12h18',
      command: (e) => e.chain().focus().setHorizontalRule().run(),
    },
    {
      id: 'callout',
      label: t.callout,
      description: t.calloutDesc,
      icon: 'M12 3l9 16H3zM12 9v4M12 16h.01',
      command: (e) => e.chain().focus().setCallout().run(),
    },
    {
      id: 'example',
      label: t.example,
      description: t.exampleDesc,
      icon: 'M4 5h16v14H4zM8 9h8M8 13h5',
      command: (e) => e.chain().focus().setExample().run(),
    },
  ]
}
