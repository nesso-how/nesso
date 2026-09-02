// SPDX-License-Identifier: MIT
import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { exitSuggestion, SuggestionPluginKey } from '@tiptap/suggestion'
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

const SLASH_POPUP_GAP_PX = 6

export function positionSlashPopup(popup: HTMLDivElement, rect: DOMRect): void {
  const belowTop = rect.bottom + SLASH_POPUP_GAP_PX
  popup.style.maxHeight = ''
  const measured = popup.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const left = Math.min(Math.max(0, rect.left), Math.max(0, viewportWidth - measured.width))
  const fitsBelow = belowTop + measured.height <= viewportHeight
  const availableHeight = fitsBelow ? viewportHeight - belowTop : rect.top - SLASH_POPUP_GAP_PX

  popup.style.left = `${left}px`
  popup.style.maxHeight = `${Math.max(0, availableHeight)}px`
  popup.style.overflowY = 'auto'
  if (fitsBelow) {
    popup.style.top = `${belowTop}px`
    popup.style.transform = ''
  } else {
    popup.style.top = `${rect.top - SLASH_POPUP_GAP_PX}px`
    popup.style.transform = 'translateY(-100%)'
  }
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
    let getClientRect: (() => DOMRect | null) | null = null

    const position = (rect: DOMRect | null) => {
      if (!rect || !popup) return
      positionSlashPopup(popup, rect)
    }

    const reposition = () => position(getClientRect?.() ?? null)

    const exitAndRestoreEditorFocus = () => {
      exitSuggestion(editor.view)
      queueMicrotask(() => {
        if (!editor.isDestroyed) editor.view.focus()
      })
    }

    // The popup is rendered outside ProseMirror, so an Escape that starts on a
    // menu item never reaches the suggestion plugin's DOM handler. Consult the
    // plugin state and dispatch its official exit transaction instead of only
    // removing the popup DOM.
    const onWindowEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const state = SuggestionPluginKey.getState(editor.state) as { active?: boolean } | undefined
      if (!state?.active) return
      e.preventDefault()
      e.stopPropagation()
      exitAndRestoreEditorFocus()
    }

    const destroyPopup = () => {
      window.removeEventListener('keydown', onWindowEscape, true)
      if (!popup && !component) return
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
      popup?.removeEventListener('keydown', onPopupEscape, true)
      popup?.remove()
      popup = null
      component?.destroy()
      component = null
      getClientRect = null
    }

    // Escape while the focus is on the popup is handled at window capture by
    // onWindowEscape. This listener is a fallback for a popup event that has
    // already been isolated from the window event path.
    const onPopupEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      e.stopPropagation()
      exitAndRestoreEditorFocus()
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
            popup.className = 'nesso-scrollbar'
            popup.dataset.writingSlashPopup = 'true'
            // `fixed` matches the viewport-relative `clientRect()` so the menu
            // tracks the caret regardless of page scroll.
            popup.style.position = 'fixed'
            popup.style.zIndex = '80'
            popup.appendChild(component.element)
            popup.addEventListener('keydown', onPopupEscape, true)
            document.body.appendChild(popup)
            window.addEventListener('keydown', onWindowEscape, true)
            getClientRect = props.clientRect ?? null
            window.addEventListener('resize', reposition)
            window.addEventListener('scroll', reposition, true)
            position(props.clientRect?.() ?? null)
          },
          onUpdate: (props) => {
            component?.updateProps(props)
            getClientRect = props.clientRect ?? null
            position(props.clientRect?.() ?? null)
          },
          onKeyDown: (props) => {
            if (props.event.key === 'Escape') {
              props.event.preventDefault()
              exitSuggestion(editor.view)
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
