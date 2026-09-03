// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'
import type { Node } from '@xyflow/react'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '@/store'
import type { ConceptNodeData, NotesDocument } from '@/types/graph'
import en from '@/i18n/locales/en'
import type { ReactElement } from 'react'
import { installProseMirrorGeometryStubs } from '@/test/prosemirrorGeometry'
import { createReactTestRoot } from '@/test/reactTestUtils'
import { WritingMode } from './WritingMode'

let container: HTMLDivElement | null = null
let root: Root | null = null

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

installProseMirrorGeometryStubs()

const notes = (text: string): NotesDocument => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

function conceptNode(
  id: string,
  definition = 'The active construction of meaning.',
): Node<ConceptNodeData> {
  return {
    id,
    type: 'concept',
    position: { x: 0, y: 0 },
    data: {
      text: 'Understanding',
      stability: 0,
      difficulty: 0,
      reps: 0,
      lapses: 0,
      fsrsState: 0,
      due: 0,
      lastReview: 0,
      lastRating: 0,
      elaboration: {
        definition,
        notes: notes('some words'),
      },
    },
  }
}

async function renderUI(ui: ReactElement) {
  const r = root
  if (r === null) throw new Error('test root not initialized')
  r.render(ui)
  await tick()
}

async function unmountUI() {
  const r = root
  if (r === null) return
  r.unmount()
  root = null
  await tick()
}

function queryProseMirror(): HTMLElement {
  const pm = document.querySelector<HTMLElement>('.writing-editor .ProseMirror')
  if (pm === null) throw new Error('editor not mounted')
  return pm
}

function currentNotesJson(): string {
  const stored = useGraphStore.getState().nodes.find((node) => node.id === 'n1')
  return JSON.stringify(stored?.data.elaboration?.notes)
}

function typeIntoEditor(text: string) {
  const pm = queryProseMirror()
  // No pm.focus(): the focused-editor scroll path (focus → scrollIntoView →
  // coordsAtPos on a text node) is unsupported in jsdom and leaves DOM
  // selection artifacts behind. Paste uses the editor's internal selection.
  // jsdom has no `document.execCommand`/ClipboardEvent; ProseMirror applies a
  // paste of plain text through its real input pipeline (replaceSelection →
  // onUpdate), which is as close to real typing as jsdom allows. The clipboard
  // payload is attached via defineProperty so the stub stays untyped-cast-free.
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: (type: string) => (type === 'text/plain' ? text : '') },
  })
  pm.dispatchEvent(event)
}

beforeEach(() => {
  useGraphStore.setState({
    nodes: [conceptNode('n1')],
    edges: [],
    selected: { kind: 'node', id: 'n1' },
    currentGraphId: 'g1',
    loadedToken: 1,
    graphList: [{ id: 'g1', name: 'Understanding', updatedAt: 1 }],
    writingModeNodeId: 'n1',
  })
  const mounted = createReactTestRoot()
  container = mounted.container
  root = mounted.root
})

afterEach(async () => {
  await unmountUI()
  container?.remove()
  container = null
  useGraphStore.setState({
    nodes: [],
    edges: [],
    selected: null,
    writingModeNodeId: null,
  })
})

describe('WritingMode', () => {
  it('renders an X-only header with the node-name title; close returns control', async () => {
    const onClose = vi.fn()
    await renderUI(<WritingMode nodeId="n1" onClose={onClose} />)
    const dialog = document.querySelector('[data-testid="writing-mode"]')
    expect(dialog).not.toBeNull()
    // Canvas-area dialog semantics: the Inspector stays visible and interactive
    // beside the writing surface.
    expect(dialog?.getAttribute('role')).toBe('dialog')
    expect(dialog?.getAttribute('aria-modal')).toBeNull()
    expect(dialog?.getAttribute('aria-labelledby')).toBe('writing-mode-title')
    // Header keeps ONLY the close X: no pill, no breadcrumb, no word count.
    expect(document.querySelector('[data-testid="writing-mode-words"]')).toBeNull()
    expect(document.body.textContent).not.toContain(en.writing.snippetsMenu)
    // The H1 title carries the node name.
    const title = document.querySelector('[data-testid="writing-mode-title"]')
    expect(title?.tagName).toBe('H1')
    expect(title?.id).toBe('writing-mode-title')
    expect(title?.textContent).toBe('Understanding')
    // CloseButton renders its own 28px <button> inside the settings-style
    // absolute wrapper.
    const closeButton = document.querySelector<HTMLButtonElement>(
      '[data-testid="writing-mode-close"] button',
    )
    if (closeButton === null) throw new Error('close button not rendered')
    const closeWrapper = closeButton.parentElement
    if (closeWrapper === null) throw new Error('close button wrapper not rendered')
    expect(closeWrapper.style.position).toBe('absolute')
    expect(closeWrapper.style.top).toBe('12px')
    expect(closeWrapper.style.right).toBe('12px')
    expect(closeButton.style.width).toBe('28px')
    expect(closeButton.style.height).toBe('28px')
    closeButton.click()
    expect(onClose).toHaveBeenCalled()
  })

  it('confines the overlay to the visible canvas instead of covering app chrome', async () => {
    await renderUI(
      <WritingMode
        nodeId="n1"
        onClose={() => {}}
        canvasInsets={{ top: 52, right: 280, bottom: 24, left: 220 }}
      />,
    )
    const backdrop = document.querySelector<HTMLElement>('[data-testid="writing-mode-backdrop"]')
    expect(backdrop?.style.top).toBe('52px')
    expect(backdrop?.style.right).toBe('280px')
    expect(backdrop?.style.bottom).toBe('24px')
    expect(backdrop?.style.left).toBe('220px')
  })

  it('leaves Tab available to the Inspector and restores its trigger on explicit close', async () => {
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.dataset.testid = 'inspector-notes-write'
    document.body.appendChild(trigger)
    trigger.focus()

    try {
      const onClose = vi.fn()
      await renderUI(<WritingMode nodeId="n1" onClose={onClose} />)
      const closeButton = document.querySelector<HTMLButtonElement>(
        '[data-testid="writing-mode-close"] button',
      )
      queryProseMirror()
      if (closeButton === null) throw new Error('close button not rendered')

      trigger.focus()
      const entered = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      })
      window.dispatchEvent(entered)
      expect(entered.defaultPrevented).toBe(false)

      closeButton.click()
      expect(onClose).toHaveBeenCalledTimes(1)
      await unmountUI()
      expect(document.activeElement).toBe(trigger)
    } finally {
      trigger.remove()
    }
  })

  it('shows the node definition as read-only context below the title', async () => {
    await renderUI(<WritingMode nodeId="n1" onClose={() => {}} />)
    const context = document.querySelector('[data-testid="writing-mode-definition"]')
    expect(context).not.toBeNull()
    expect(context?.textContent).toBe('The active construction of meaning.')
  })

  it('hides the definition context when the node has no definition', async () => {
    useGraphStore.setState({ nodes: [conceptNode('n1', '')] })
    await renderUI(<WritingMode nodeId="n1" onClose={() => {}} />)
    expect(document.querySelector('[data-testid="writing-mode-definition"]')).toBeNull()
  })

  it('renders nothing when the node no longer exists (deleted while writing)', async () => {
    await renderUI(<WritingMode nodeId="ghost" onClose={() => {}} />)
    expect(document.querySelector('[data-testid="writing-mode"]')).toBeNull()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    await renderUI(<WritingMode nodeId="n1" onClose={onClose} />)
    const dialog = document.querySelector<HTMLElement>('[data-testid="writing-mode"]')
    dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape while the editor is focused (capture phase, before ProseMirror consumes it)', async () => {
    const onClose = vi.fn()
    await renderUI(<WritingMode nodeId="n1" onClose={onClose} />)
    const pm = queryProseMirror()
    // ProseMirror's own keydown handling preventDefaults Escape (keyCode 27)
    // in the bubble phase; the capture-phase listener must decide first.
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    pm.dispatchEvent(event)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('does not close on Escape while the slash menu is open', async () => {
    const onClose = vi.fn()
    await renderUI(<WritingMode nodeId="n1" onClose={onClose} />)
    // The suggestion matcher requires the `/` to start a query (preceded by
    // whitespace), mirroring the e2e flow: type a word, then the slash.
    typeIntoEditor(' /')
    await tick()
    const pm = queryProseMirror()
    expect(document.querySelector('[role="listbox"]')).not.toBeNull()
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    pm.dispatchEvent(event)
    expect(onClose).not.toHaveBeenCalled()
    // The popup consumed the Escape and dismissed itself.
    expect(document.querySelector('[role="listbox"]')).toBeNull()
    // Let the paste's async ProseMirror work settle before the env tears down.
    await tick()
  })

  it('uses the popup wrapper as the only slash-menu scroll container', async () => {
    await renderUI(<WritingMode nodeId="n1" onClose={() => {}} />)
    typeIntoEditor(' /')
    await tick()
    await tick()

    const listbox = document.querySelector<HTMLElement>('[role="listbox"]')
    const popup = listbox?.parentElement?.parentElement
    if (listbox === null || popup === null || listbox === undefined || popup === undefined) {
      throw new Error('slash popup not rendered')
    }
    expect(popup.classList.contains('nesso-scrollbar')).toBe(true)
    expect(popup.style.overflowY).toBe('auto')
    expect(listbox.classList.contains('nesso-scrollbar')).toBe(false)
    expect(listbox.style.overflowY).toBe('')
  })

  it('Escape with focus on the popup closes ONLY the menu; a second Escape closes the overlay', async () => {
    const onClose = vi.fn()
    await renderUI(<WritingMode nodeId="n1" onClose={onClose} />)
    typeIntoEditor(' /')
    await tick()
    await tick()
    // Focus moved onto a popup item (click/tab): the keydown never reaches
    // ProseMirror, so the popup container's own Escape listener must close
    // ONLY the menu — the overlay stays open.
    const option = document.querySelector<HTMLElement>('[role="option"]')
    if (!option) throw new Error('popup option not rendered')
    option.focus()
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    option.dispatchEvent(event)
    expect(document.querySelector('[role="listbox"]')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    await tick()
    expect(document.activeElement).toBe(queryProseMirror())
    // With the menu closed, the next Escape closes the overlay.
    queryProseMirror().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores Escape when the event was already consumed (defaultPrevented)', async () => {
    const onClose = vi.fn()
    await renderUI(<WritingMode nodeId="n1" onClose={onClose} />)
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    event.preventDefault()
    const dialog = document.querySelector<HTMLElement>('[data-testid="writing-mode"]')
    dialog?.dispatchEvent(event)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('commits notes directly to the store and preserves the definition', async () => {
    await renderUI(<WritingMode nodeId="n1" onClose={() => {}} />)
    typeIntoEditor(' flushed text')
    expect(currentNotesJson()).toContain('flushed text')
    expect(useGraphStore.getState().nodes[0]?.data.elaboration?.definition).toBe(
      'The active construction of meaning.',
    )
  })

  it('does not recreate a deleted node when the editor unmounts', async () => {
    await renderUI(<WritingMode nodeId="n1" onClose={() => {}} />)
    typeIntoEditor(' doomed')
    useGraphStore.setState({ nodes: [] })
    await tick()
    expect(document.querySelector('[data-testid="writing-mode"]')).toBeNull()
    await unmountUI()
    expect(useGraphStore.getState().nodes).toEqual([])
  })
})
