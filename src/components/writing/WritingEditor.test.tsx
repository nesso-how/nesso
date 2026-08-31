// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import type { SuggestionProps } from '@tiptap/suggestion'
import en from '@/i18n/locales/en'
import type { NotesDocument } from '@/types/graph'
import type { SnippetDefinition } from './snippets/registry'
import { SLASH_MENU_LABEL_KEY, SlashMenu, type SlashMenuRef } from './SlashMenu'
import { WritingEditor } from './WritingEditor'

let container: HTMLDivElement | null = null
let root: Root | null = null

const notes = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

const keydown = (key: string) =>
  new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })

const snippetItem = (id: string): SnippetDefinition => ({
  id,
  label: id,
  description: '',
  icon: 'M3 12h18',
  command: () => {},
})

// jsdom has no MessageChannel, so React's scheduler (and passive-effect flush)
// falls back to delayed timers; act() makes render/effect timing deterministic.
async function renderUI(ui: React.ReactElement) {
  await act(async () => {
    root!.render(ui)
  })
}

async function unmountUI() {
  if (root === null) return
  await act(async () => {
    root!.unmount()
  })
  root = null
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container!)
})

afterEach(async () => {
  await unmountUI()
  container?.remove()
  container = null
  vi.useRealTimers()
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
})

describe('WritingEditor', () => {
  it('renders the editor with initial notes and reports the word count', async () => {
    const onWordCountChange = vi.fn()
    const onCommit = vi.fn()
    await renderUI(
      <WritingEditor
        identityKey="n1"
        definition="def"
        placeholder={en.writing.placeholder}
        initialNotes={notes('hello world') as never}
        onCommit={onCommit}
        onWordCountChange={onWordCountChange}
        snippets={en.writing.snippets}
      />,
    )
    expect(document.querySelector('.writing-editor .ProseMirror')).not.toBeNull()
    expect(onWordCountChange).toHaveBeenCalledWith(expect.any(Number))
  })

  it('falls back to the placeholder for the menu label when menuLabel is absent', async () => {
    const onCommit = vi.fn()
    const props = {
      identityKey: 'n1',
      definition: 'def',
      placeholder: en.writing.placeholder,
      onCommit,
      onWordCountChange: () => {},
      snippets: en.writing.snippets,
    }
    await renderUI(<WritingEditor {...props} initialNotes={undefined} />)
    expect(document.querySelector('.writing-editor')?.getAttribute('data-menu-label')).toBe(
      en.writing.placeholder,
    )
    await renderUI(<WritingEditor {...props} initialNotes={undefined} menuLabel="Writing mode" />)
    expect(document.querySelector('.writing-editor')?.getAttribute('data-menu-label')).toBe(
      'Writing mode',
    )
  })

  it('commits the pending edit through the trailing debounce (~800 ms), canonicalized', async () => {
    // Fake timers from the start so the debounce timer itself is faked.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const onCommit = vi.fn()
    await renderUI(
      <WritingEditor
        identityKey="n1"
        definition="def"
        placeholder={en.writing.placeholder}
        initialNotes={notes('pending text') as never}
        onCommit={onCommit}
        onWordCountChange={() => {}}
        snippets={en.writing.snippets}
      />,
    )
    const pm = document.querySelector('.writing-editor .ProseMirror') as HTMLElement
    pm.focus()
    // jsdom has no `document.execCommand`; dispatching a printable keydown runs
    // the edit through ProseMirror's real keymap (splitBlock → onUpdate).
    await act(async () => {
      pm.dispatchEvent(keydown('Enter'))
    })
    expect(onCommit).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(800)
    })
    expect(onCommit).toHaveBeenCalledTimes(1)
    const committed = onCommit.mock.calls[0][0]
    expect(committed === undefined || committed.type === 'doc').toBe(true)
    // The timer already fired: unmount must not commit again.
    await unmountUI()
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('flushes a pending edit through onCommit on unmount and cancels the debounce', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const onCommit = vi.fn()
    await renderUI(
      <WritingEditor
        identityKey="n1"
        definition="def"
        placeholder={en.writing.placeholder}
        initialNotes={notes('pending text') as never}
        onCommit={onCommit}
        onWordCountChange={() => {}}
        snippets={en.writing.snippets}
      />,
    )
    const pm = document.querySelector('.writing-editor .ProseMirror') as HTMLElement
    pm.focus()
    await act(async () => {
      pm.dispatchEvent(keydown('Enter'))
    })
    await unmountUI()
    expect(onCommit).toHaveBeenCalledTimes(1)
    const committed = onCommit.mock.calls[0][0]
    expect(committed === undefined || committed.type === 'doc').toBe(true)
    // The debounced timer was canceled by the flush: no double commit.
    await act(async () => {
      vi.advanceTimersByTime(2_000)
    })
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('commits exactly `undefined` when the pending edit canonicalizes to empty', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const onCommit = vi.fn()
    await renderUI(
      <WritingEditor
        identityKey="n1"
        definition="def"
        placeholder={en.writing.placeholder}
        initialNotes={undefined}
        onCommit={onCommit}
        onWordCountChange={() => {}}
        snippets={en.writing.snippets}
      />,
    )
    const pm = document.querySelector('.writing-editor .ProseMirror') as HTMLElement
    pm.focus()
    await act(async () => {
      pm.dispatchEvent(keydown('Enter'))
    })
    await unmountUI()
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit.mock.calls[0][0]).toBeUndefined()
    await act(async () => {
      vi.advanceTimersByTime(2_000)
    })
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('absorbs a post-save prop refresh that is deep-equal to the last commit', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const onCommit = vi.fn()
    await renderUI(
      <WritingEditor
        identityKey="n1"
        definition="def"
        placeholder={en.writing.placeholder}
        initialNotes={notes('draft one') as never}
        onCommit={onCommit}
        onWordCountChange={() => {}}
        snippets={en.writing.snippets}
      />,
    )
    const pm = document.querySelector('.writing-editor .ProseMirror') as HTMLElement
    await act(async () => {
      pm.dispatchEvent(keydown('Enter'))
    })
    await act(async () => {
      vi.advanceTimersByTime(800)
    })
    expect(onCommit).toHaveBeenCalledTimes(1)
    // The store saved; the parent refreshes with a fresh deep-equal notes
    // object while a newer edit is pending.
    const committed = structuredClone(onCommit.mock.calls[0][0]) as NotesDocument
    await act(async () => {
      pm.dispatchEvent(keydown('Enter'))
    })
    await renderUI(
      <WritingEditor
        identityKey="n1"
        definition="def"
        placeholder={en.writing.placeholder}
        initialNotes={committed}
        onCommit={onCommit}
        onWordCountChange={() => {}}
        snippets={en.writing.snippets}
      />,
    )
    // Suppression: the refresh must not cancel the pending debounce.
    await act(async () => {
      vi.advanceTimersByTime(2_000)
    })
    expect(onCommit).toHaveBeenCalledTimes(2)
    await unmountUI()
    expect(onCommit).toHaveBeenCalledTimes(2)
  })

  it('resets content in place when initialNotes identity changes, without committing', async () => {
    const onCommit = vi.fn()
    const props = {
      identityKey: 'n1',
      definition: 'def',
      placeholder: en.writing.placeholder,
      onCommit,
      onWordCountChange: () => {},
      snippets: en.writing.snippets,
    }
    await renderUI(<WritingEditor {...props} initialNotes={notes('v1') as never} />)
    await renderUI(<WritingEditor {...props} initialNotes={notes('v2') as never} />)
    const pm = document.querySelector('.writing-editor .ProseMirror') as HTMLElement
    expect(pm.textContent).toContain('v2')
    expect(pm.textContent).not.toContain('v1')
    await unmountUI()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('cancels a pending edit when identityKey switches, even with equal notes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const onCommit = vi.fn()
    const sharedNotes = notes('shared text') as never
    const base = {
      identityKey: 'n1',
      definition: 'def',
      placeholder: en.writing.placeholder,
      onCommit,
      onWordCountChange: () => {},
      snippets: en.writing.snippets,
      initialNotes: sharedNotes,
    }
    await renderUI(<WritingEditor {...base} />)
    const pm = document.querySelector('.writing-editor .ProseMirror') as HTMLElement
    // No pm.focus() here: the focused-editor path of the later setContent
    // (focus → scrollIntoView → coordsAtPos) is unsupported in jsdom, and the
    // keymap-driven Enter dispatch below does not require DOM focus.
    await act(async () => {
      pm.dispatchEvent(keydown('Enter'))
    })
    // Switch concept: same notes object, different identity key.
    await renderUI(<WritingEditor {...base} identityKey="n2" />)
    expect(document.querySelector('.writing-editor')?.getAttribute('data-identity')).toBe('n2')
    // The stale debounce is canceled and its pending edit dropped.
    await act(async () => {
      vi.advanceTimersByTime(2_000)
    })
    expect(onCommit).not.toHaveBeenCalled()
    await unmountUI()
    expect(onCommit).not.toHaveBeenCalled()
  })
})

describe('SlashMenu keyboard navigation', () => {
  function stubEditor(storage: Record<string, unknown>) {
    return { storage } as never
  }

  it('labels the listbox from the stored menu label, never with item text', async () => {
    const items = ['a', 'b', 'c'].map(snippetItem)
    const command = vi.fn()
    let menuRef: SlashMenuRef | null = null
    const props = {
      items,
      command,
      editor: stubEditor({ [SLASH_MENU_LABEL_KEY]: 'Writing mode' }),
    } as unknown as SuggestionProps<SnippetDefinition>
    await renderUI(
      <SlashMenu
        {...props}
        ref={(r) => {
          menuRef = r
        }}
      />,
    )
    const listbox = document.querySelector('[role="listbox"]')
    expect(listbox).not.toBeNull()
    expect(listbox?.getAttribute('aria-label')).toBe('Writing mode')
    const selectedId = () =>
      document.querySelector('[aria-selected="true"]')?.getAttribute('data-testid')
    expect(selectedId()).toBe('slash-item-a')
    await act(async () => {
      expect(menuRef!.onKeyDown({ event: keydown('ArrowDown') })).toBe(true)
    })
    expect(selectedId()).toBe('slash-item-b')
    await act(async () => {
      expect(menuRef!.onKeyDown({ event: keydown('ArrowUp') })).toBe(true)
      // Wraps from the first item back to the last.
      expect(menuRef!.onKeyDown({ event: keydown('ArrowUp') })).toBe(true)
    })
    expect(selectedId()).toBe('slash-item-c')
    await act(async () => {
      expect(menuRef!.onKeyDown({ event: keydown('Enter') })).toBe(true)
    })
    expect(command).toHaveBeenCalledWith(items[2])
    // Unhandled keys pass through to the editor.
    expect(menuRef!.onKeyDown({ event: keydown('Tab') })).toBe(false)
    expect(command).toHaveBeenCalledTimes(1)
  })

  it('leaves the listbox unlabeled when the stored menu label is missing', async () => {
    const items = ['a', 'b'].map(snippetItem)
    const props = {
      items,
      command: vi.fn(),
      editor: stubEditor({}),
    } as unknown as SuggestionProps<SnippetDefinition>
    await renderUI(<SlashMenu {...props} />)
    const listbox = document.querySelector('[role="listbox"]')
    expect(listbox).not.toBeNull()
    // Never fall back to the first item's text.
    expect(listbox?.getAttribute('aria-label')).toBeNull()
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(2)
  })

  it('clamps the selection synchronously when the items list shrinks, so Enter still works', async () => {
    const command = vi.fn()
    let menuRef: SlashMenuRef | null = null
    const propsA = {
      items: ['a', 'b', 'c'].map(snippetItem),
      command,
      editor: stubEditor({ [SLASH_MENU_LABEL_KEY]: 'Writing mode' }),
    } as unknown as SuggestionProps<SnippetDefinition>
    await renderUI(
      <SlashMenu
        {...propsA}
        ref={(r) => {
          menuRef = r
        }}
      />,
    )
    await act(async () => {
      expect(menuRef!.onKeyDown({ event: keydown('ArrowDown') })).toBe(true)
      expect(menuRef!.onKeyDown({ event: keydown('ArrowDown') })).toBe(true)
    })
    // Shrink to a single item while the selection sits past the end: the next
    // lookup must be clamped before it reads the index.
    const propsB = {
      items: [snippetItem('only')],
      command,
      editor: stubEditor({ [SLASH_MENU_LABEL_KEY]: 'Writing mode' }),
    } as unknown as SuggestionProps<SnippetDefinition>
    await renderUI(
      <SlashMenu
        {...propsB}
        ref={(r) => {
          menuRef = r
        }}
      />,
    )
    const options = [...document.querySelectorAll('[role="option"]')]
    expect(options).toHaveLength(1)
    expect(options[0]?.getAttribute('aria-selected')).toBe('true')
    expect(options[0]?.getAttribute('data-testid')).toBe('slash-item-only')
    await act(async () => {
      expect(menuRef!.onKeyDown({ event: keydown('Enter') })).toBe(true)
    })
    expect(command).toHaveBeenCalledWith(expect.objectContaining({ id: 'only' }))
  })
})
