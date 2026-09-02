// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import { act } from 'react'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import type { SuggestionProps } from '@tiptap/suggestion'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Root } from 'react-dom/client'
import en from '@/i18n/locales/en'
import { installProseMirrorGeometryStubs } from '@/test/prosemirrorGeometry'
import { createReactTestRoot } from '@/test/reactTestUtils'
import type { NotesDocument } from '@/types/graph'
import type { ComponentProps, ReactElement } from 'react'
import type { SnippetDefinition } from './snippets/registry'
import { SLASH_MENU_LABEL_KEY, SlashMenu, type SlashMenuRef } from './SlashMenu'
import { WritingEditor } from './WritingEditor'

let container: HTMLDivElement | null = null
let root: Root | null = null

// Every headless `Editor` created by the typed stubs below; destroyed in
// afterEach so ProseMirror views/listeners never leak across tests.
const createdEditors: Editor[] = []

const notes = (text: string): NotesDocument => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

type WritingEditorProps = ComponentProps<typeof WritingEditor>

function editorProps(
  onCommit: WritingEditorProps['onCommit'],
  initialNotes: WritingEditorProps['initialNotes'],
  overrides: Partial<WritingEditorProps> = {},
): WritingEditorProps {
  return {
    identityKey: 'n1',
    definition: 'def',
    placeholder: en.writing.placeholder,
    initialNotes,
    onCommit,
    onWordCountChange: () => {},
    snippets: en.writing.snippets,
    ...overrides,
  }
}

async function renderEditor(
  onCommit: WritingEditorProps['onCommit'],
  initialNotes: WritingEditorProps['initialNotes'],
  overrides: Partial<WritingEditorProps> = {},
): Promise<void> {
  await renderUI(<WritingEditor {...editorProps(onCommit, initialNotes, overrides)} />)
}

const keydown = (key: string) =>
  new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })

const snippetItem = (id: string): SnippetDefinition => ({
  id,
  label: id,
  description: '',
  icon: 'M3 12h18',
  command: () => {},
})

installProseMirrorGeometryStubs()

// jsdom has no MessageChannel, so React's scheduler (and passive-effect flush)
// falls back to delayed timers; act() makes render/effect timing deterministic.
async function renderUI(ui: ReactElement) {
  const r = root
  if (r === null) throw new Error('test root not initialized')
  await act(async () => {
    r.render(ui)
  })
}

async function unmountUI() {
  const r = root
  if (r === null) return
  await act(async () => {
    r.unmount()
  })
  root = null
}

function queryProseMirror(): HTMLElement {
  const pm = document.querySelector<HTMLElement>('.writing-editor .ProseMirror')
  if (pm === null) throw new Error('editor not mounted')
  return pm
}

function replaceEditorText(text: string): void {
  const pm = queryProseMirror()
  pm.focus()
  const selectAll = new KeyboardEvent('keydown', {
    key: 'a',
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
  })
  pm.dispatchEvent(selectAll)
  const paste = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(paste, 'clipboardData', {
    value: { getData: (type: string) => (type === 'text/plain' ? text : '') },
  })
  pm.dispatchEvent(paste)
}

async function dispatchEditorEdit(pm: HTMLElement): Promise<void> {
  // jsdom has no `document.execCommand`; dispatching a printable keydown runs
  // the edit through ProseMirror's real keymap (splitBlock → onUpdate).
  await act(async () => {
    pm.dispatchEvent(keydown('Enter'))
  })
}

async function commitOnce(onCommit: WritingEditorProps['onCommit']): Promise<HTMLElement> {
  const pm = queryProseMirror()
  await dispatchEditorEdit(pm)
  expect(onCommit).toHaveBeenCalledTimes(1)
  return pm
}

beforeEach(() => {
  ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
  const mounted = createReactTestRoot()
  container = mounted.container
  root = mounted.root
})

afterEach(async () => {
  await unmountUI()
  container?.remove()
  container = null
  vi.useRealTimers()
  // Destroy every editor instance created by the typed stubs this test so
  // ProseMirror views/listeners never leak across tests.
  for (const editor of createdEditors.splice(0)) editor.destroy()
  ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = false
})

describe('WritingEditor', () => {
  it('renders the editor with initial notes and reports the word count', async () => {
    const onWordCountChange = vi.fn()
    const onCommit = vi.fn<(notes: NotesDocument | undefined) => void>()
    await renderEditor(onCommit, notes('hello world'), { onWordCountChange })
    expect(document.querySelector('.writing-editor .ProseMirror')).not.toBeNull()
    expect(onWordCountChange).toHaveBeenCalledWith(expect.any(Number))
  })

  it('falls back to the placeholder for the menu label when menuLabel is absent', async () => {
    const onCommit = vi.fn<(notes: NotesDocument | undefined) => void>()
    await renderEditor(onCommit, undefined)
    expect(document.querySelector('.writing-editor')?.getAttribute('data-menu-label')).toBe(
      en.writing.placeholder,
    )
    await renderEditor(onCommit, undefined, { menuLabel: 'Writing mode' })
    expect(document.querySelector('.writing-editor')?.getAttribute('data-menu-label')).toBe(
      'Writing mode',
    )
  })

  it('commits a valid edit immediately and canonicalizes it', async () => {
    const onCommit = vi.fn<(notes: NotesDocument | undefined) => void>()
    await renderEditor(onCommit, notes('pending text'))
    await commitOnce(onCommit)
    const committed = onCommit.mock.calls[0][0]
    expect(committed === undefined || committed.type === 'doc').toBe(true)
    await unmountUI()
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('shows a visible warning for invalid content without committing it', async () => {
    const onCommit = vi.fn<(notes: NotesDocument | undefined) => void>()
    await renderEditor(onCommit, notes('saved baseline'))

    await act(async () => {
      replaceEditorText('x'.repeat(100_000))
    })

    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      'This note is too large or contains unsupported formatting and won’t be saved',
    )
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('clears the warning and commits after valid content replaces it', async () => {
    const onCommit = vi.fn<(notes: NotesDocument | undefined) => void>()
    await renderEditor(onCommit, undefined)

    await act(async () => {
      replaceEditorText('x'.repeat(100_000))
    })
    expect(document.querySelector('[role="alert"]')).not.toBeNull()
    onCommit.mockClear()

    await act(async () => {
      replaceEditorText('recovered note')
    })
    expect(document.querySelector('[role="alert"]')).toBeNull()

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(onCommit.mock.calls[0][0])).toContain('recovered note')
  })

  it('does not commit invalid content when the editor unmounts', async () => {
    const onCommit = vi.fn<(notes: NotesDocument | undefined) => void>()
    await renderEditor(onCommit, notes('saved baseline'))

    await act(async () => {
      replaceEditorText('x'.repeat(100_000))
    })
    await unmountUI()

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('does not commit again when a committed editor unmounts', async () => {
    const onCommit = vi.fn<(notes: NotesDocument | undefined) => void>()
    await renderEditor(onCommit, notes('pending text'))
    await commitOnce(onCommit)
    await unmountUI()
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('commits exactly `undefined` when a valid edit canonicalizes to empty', async () => {
    const onCommit = vi.fn<(notes: NotesDocument | undefined) => void>()
    await renderEditor(onCommit, undefined)
    const pm = queryProseMirror()
    pm.focus()
    await act(async () => {
      pm.dispatchEvent(keydown('Enter'))
    })
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit.mock.calls[0][0]).toBeUndefined()
    await unmountUI()
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('absorbs a post-save prop refresh that is deep-equal to the last commit', async () => {
    const onCommit = vi.fn<(notes: NotesDocument | undefined) => void>()
    await renderEditor(onCommit, notes('draft one'))
    const pm = queryProseMirror()
    await act(async () => {
      pm.dispatchEvent(keydown('Enter'))
    })
    expect(onCommit).toHaveBeenCalledTimes(1)
    // The store saved; the parent refreshes with a fresh deep-equal notes
    // object while a newer edit is already visible in the editor.
    await new Promise((resolve) => setTimeout(resolve, 600))
    await act(async () => {
      pm.dispatchEvent(keydown('Enter'))
    })
    const committed = structuredClone(onCommit.mock.calls[1][0])
    const visibleBeforeEcho = pm.innerHTML
    await renderEditor(onCommit, committed)
    expect(onCommit).toHaveBeenCalledTimes(2)
    expect(pm.innerHTML).toBe(visibleBeforeEcho)
    await act(async () => {
      pm.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'z',
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
        }),
      )
    })
    expect(pm.querySelectorAll('p')).toHaveLength(2)
    await unmountUI()
    expect(onCommit).toHaveBeenCalledTimes(3)
  })

  it('resets when a prop refresh matches an older commit after a newer commit', async () => {
    const onCommit = vi.fn<(notes: NotesDocument | undefined) => void>()
    await renderEditor(onCommit, notes('draft one'))
    const pm = queryProseMirror()
    await act(async () => {
      replaceEditorText('commit A')
    })
    const commitA = structuredClone(onCommit.mock.calls[0][0])
    await act(async () => {
      replaceEditorText('commit B')
    })
    expect(onCommit).toHaveBeenCalledTimes(2)
    const visibleAfterCommitB = pm.innerHTML
    expect(pm.textContent).toBe('commit B')

    await renderEditor(onCommit, commitA)

    expect(pm.innerHTML).not.toBe(visibleAfterCommitB)
    expect(pm.textContent).toBe('commit A')
    expect(onCommit).toHaveBeenCalledTimes(2)
    await unmountUI()
    expect(onCommit).toHaveBeenCalledTimes(2)
  })

  it('resets content in place when initialNotes identity changes, without committing', async () => {
    const onCommit = vi.fn<(notes: NotesDocument | undefined) => void>()
    await renderEditor(onCommit, notes('v1'))
    await renderEditor(onCommit, notes('v2'))
    const pm = queryProseMirror()
    expect(pm.textContent).toContain('v2')
    expect(pm.textContent).not.toContain('v1')
    await unmountUI()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('resets update-free when identityKey switches, even with equal notes', async () => {
    const onCommit = vi.fn<(notes: NotesDocument | undefined) => void>()
    const sharedNotes = notes('shared text')
    await renderEditor(onCommit, sharedNotes)
    const pm = queryProseMirror()
    // No pm.focus() here: the focused-editor path of the later setContent
    // (focus → scrollIntoView → coordsAtPos) is unsupported in jsdom, and the
    // keymap-driven Enter dispatch below does not require DOM focus.
    await act(async () => {
      pm.dispatchEvent(keydown('Enter'))
    })
    expect(onCommit).toHaveBeenCalledTimes(1)
    // Switch concept: same notes object, different identity key.
    await renderEditor(onCommit, sharedNotes, { identityKey: 'n2' })
    expect(document.querySelector('.writing-editor')?.getAttribute('data-identity')).toBe('n2')
    expect(pm.querySelectorAll('p')).toHaveLength(1)
    expect(onCommit).toHaveBeenCalledTimes(1)
    await unmountUI()
    expect(onCommit).toHaveBeenCalledTimes(1)
  })
})

describe('SlashMenu keyboard navigation', () => {
  // A real headless TipTap editor is the fully-typed `Editor` stub: the menu
  // only reads `editor.storage`, and a genuine instance needs no casts. Every
  // created instance is tracked and destroyed in the global afterEach.
  function stubEditor(storage: Record<string, unknown>): Editor {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit],
    })
    createdEditors.push(editor)
    Object.assign(editor.storage, storage)
    return editor
  }

  // SuggestionProps carries many plugin-managed fields the menu never reads;
  // this fills them with typed inert defaults.
  function makeSuggestionProps(
    partial: Pick<SuggestionProps<SnippetDefinition>, 'items' | 'command' | 'editor'>,
  ): SuggestionProps<SnippetDefinition> {
    return {
      range: { from: 0, to: 0 },
      query: '',
      text: '',
      decorationNode: null,
      placement: 'bottom-start',
      offset: { mainAxis: 4, crossAxis: 0 },
      flip: true,
      floatingUi: { placement: 'bottom-start', strategy: 'absolute', middleware: [] },
      mount: () => () => {},
      loading: false,
      ...partial,
    }
  }

  function menuRefOf(): SlashMenuRef {
    const menu = menuRef
    if (menu === null) throw new Error('menu ref not captured')
    return menu
  }

  let menuRef: SlashMenuRef | null = null

  afterEach(() => {
    menuRef = null
  })

  it('labels the listbox from the stored menu label, never with item text', async () => {
    const items = ['a', 'b', 'c'].map(snippetItem)
    const command = vi.fn()
    const props = makeSuggestionProps({
      items,
      command,
      editor: stubEditor({ [SLASH_MENU_LABEL_KEY]: 'Writing mode' }),
    })
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
      expect(menuRefOf().onKeyDown({ event: keydown('ArrowDown') })).toBe(true)
    })
    expect(selectedId()).toBe('slash-item-b')
    await act(async () => {
      expect(menuRefOf().onKeyDown({ event: keydown('ArrowUp') })).toBe(true)
      // Wraps from the first item back to the last.
      expect(menuRefOf().onKeyDown({ event: keydown('ArrowUp') })).toBe(true)
    })
    expect(selectedId()).toBe('slash-item-c')
    await act(async () => {
      expect(menuRefOf().onKeyDown({ event: keydown('Enter') })).toBe(true)
    })
    expect(command).toHaveBeenCalledWith(items[2])
    // Unhandled keys pass through to the editor.
    expect(menuRefOf().onKeyDown({ event: keydown('Tab') })).toBe(false)
    expect(command).toHaveBeenCalledTimes(1)
  })

  it('leaves the listbox unlabeled when the stored menu label is missing', async () => {
    const items = ['a', 'b'].map(snippetItem)
    const props = makeSuggestionProps({ items, command: vi.fn(), editor: stubEditor({}) })
    await renderUI(<SlashMenu {...props} />)
    const listbox = document.querySelector('[role="listbox"]')
    expect(listbox).not.toBeNull()
    // Never fall back to the first item's text.
    expect(listbox?.getAttribute('aria-label')).toBeNull()
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(2)
  })

  it('clamps the selection synchronously when the items list shrinks, so Enter still works', async () => {
    const command = vi.fn()
    const propsA = makeSuggestionProps({
      items: ['a', 'b', 'c'].map(snippetItem),
      command,
      editor: stubEditor({ [SLASH_MENU_LABEL_KEY]: 'Writing mode' }),
    })
    await renderUI(
      <SlashMenu
        {...propsA}
        ref={(r) => {
          menuRef = r
        }}
      />,
    )
    await act(async () => {
      expect(menuRefOf().onKeyDown({ event: keydown('ArrowDown') })).toBe(true)
      expect(menuRefOf().onKeyDown({ event: keydown('ArrowDown') })).toBe(true)
    })
    // Shrink to a single item while the selection sits past the end: the next
    // lookup must be clamped before it reads the index.
    const propsB = makeSuggestionProps({
      items: [snippetItem('only')],
      command,
      editor: stubEditor({ [SLASH_MENU_LABEL_KEY]: 'Writing mode' }),
    })
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
      expect(menuRefOf().onKeyDown({ event: keydown('Enter') })).toBe(true)
    })
    expect(command).toHaveBeenCalledWith(expect.objectContaining({ id: 'only' }))
  })
})
