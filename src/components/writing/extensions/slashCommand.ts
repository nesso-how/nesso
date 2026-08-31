// SPDX-License-Identifier: MIT
import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import { getT } from '@/i18n'
import { SlashMenu } from '../SlashMenu'
import { buildSnippets, type SnippetDefinition, type SnippetStrings } from '../snippets/registry'

interface SlashMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

export interface SlashCommandOptions {
  /** Snippet label strings. When unset, the active locale resolves at open
   *  time via `getT()`. */
  snippets?: SnippetStrings
}

// Open-popup count across the app. WritingMode's Escape handling runs in the
// window CAPTURE phase — before ProseMirror's bubble-phase keydown handler
// (and thus before the popup's own preventDefault below) — so the popup-open
// state must be observable out-of-band for the capture listener to leave the
// Escape to the menu. The app mounts at most one editor at a time; the count
// is lifecycle-safe (suggestion's plugin destroy fires onExit, see below).
let openPopups = 0

/** Whether a slash-command popup is currently open. */
export function isSlashMenuOpen(): boolean {
  return openPopups > 0
}

/**
 * Pure items filter over the snippet registry — shared by the suggestion
 * plugin and tests. Matches on label text or snippet id, case-insensitively.
 */
export function slashMenuItems(snippets: SnippetStrings, query: string): SnippetDefinition[] {
  const q = query.trim().toLowerCase()
  return buildSnippets(snippets).filter(
    (s) => s.label.toLowerCase().includes(q) || s.id.includes(q),
  )
}

/**
 * Notion-style `/` slash-command menu over the snippet registry. Labels resolve
 * through the configured strings or the active locale at open time; the
 * registry stays the extension point.
 */
export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return { snippets: undefined }
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    const options = this.options
    let component: ReactRenderer<SlashMenuRef> | null = null
    let popup: HTMLDivElement | null = null

    const destroyPopup = () => {
      if (!popup && !component) return
      popup?.remove()
      popup = null
      component?.destroy()
      component = null
      openPopups -= 1
    }

    const position = (rect: DOMRect | null) => {
      if (!rect || !popup) return
      popup.style.left = `${rect.left}px`
      popup.style.top = `${rect.bottom + 6}px`
    }

    return [
      Suggestion<SnippetDefinition>({
        editor,
        char: '/',
        startOfLine: false,
        items: ({ query }) => slashMenuItems(options.snippets ?? getT().writing.snippets, query),
        command: ({ editor: ed, range, props }) => {
          ed.chain().focus().deleteRange(range).run()
          props.command(ed)
        },
        render: () => ({
          onStart: (props) => {
            component = new ReactRenderer(SlashMenu, { props, editor: props.editor })
            popup = document.createElement('div')
            // `fixed` matches the viewport-relative `clientRect()` so the menu
            // tracks the caret regardless of page scroll.
            popup.style.position = 'fixed'
            popup.style.zIndex = '80'
            popup.appendChild(component.element)
            document.body.appendChild(popup)
            openPopups += 1
            position(props.clientRect?.() ?? null)
          },
          onUpdate: (props) => {
            component?.updateProps(props)
            position(props.clientRect?.() ?? null)
          },
          onKeyDown: (props) => {
            if (props.event.key === 'Escape') {
              // Mark the Escape consumed so outer listeners (app shortcuts,
              // WritingMode's bubble fallbacks) can detect it. The capture-phase
              // WritingMode listener additionally consults `isSlashMenuOpen()`.
              props.event.preventDefault()
              destroyPopup()
              return true
            }
            return component?.ref?.onKeyDown(props) ?? false
          },
          onExit: destroyPopup,
        }),
      }),
    ]
  },
})
