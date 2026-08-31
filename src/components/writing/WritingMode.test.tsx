// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'
import type { Node } from '@xyflow/react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '@/store'
import type { ConceptNodeData, NotesDocument } from '@/types/graph'
import en from '@/i18n/locales/en'
import type { ReactElement } from 'react'
import { WritingMode } from './WritingMode'

let container: HTMLDivElement | null = null
let root: Root | null = null

const originalSaveCurrentGraph = useGraphStore.getState().saveCurrentGraph
const tick = () => new Promise<void>((r) => setTimeout(r, 0))

// jsdom lacks client-rect geometry on text nodes/ranges/elements; ProseMirror's
// paste path (tr.scrollIntoView → coordsAtPos) reads them. Zero rects are fine
// here. Patched at prototype level so async paste work landing during a later
// tick (any dispatch in this file) can never hit the unpatched native throw.
{
  const zeroRect = (): DOMRect => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON: () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 }),
  })
  const zeroRects = (): DOMRectList => {
    const rects = [zeroRect()]
    return {
      length: rects.length,
      item: (index) => rects[index] ?? null,
      0: rects[0],
      [Symbol.iterator]: () => rects[Symbol.iterator](),
    }
  }
  // Element/Range expose these natively (jsdom returns degenerate rects for
  // elements but nothing for ranges); Text never carries them, so those are
  // installed via defineProperty to stay fully typed.
  for (const proto of [Element.prototype, Range.prototype]) {
    proto.getClientRects ??= zeroRects
    proto.getBoundingClientRect ??= zeroRect
  }
  Object.defineProperty(Text.prototype, 'getClientRects', { value: zeroRects })
  Object.defineProperty(Text.prototype, 'getBoundingClientRect', { value: zeroRect })
}

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
    graphList: [{ id: 'g1', name: 'Understanding', updatedAt: 1 }],
    writingModeNodeId: 'n1',
  })
  const el = document.createElement('div')
  document.body.appendChild(el)
  container = el
  root = createRoot(el)
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
    saveCurrentGraph: originalSaveCurrentGraph,
  })
  // Drain any deferred (setTimeout 0) save scheduled by a cleanup above so it
  // cannot leak into the next test.
  await tick()
})

describe('WritingMode', () => {
  it('renders an X-only header with the node-name title; close returns control', async () => {
    const onClose = vi.fn()
    await renderUI(<WritingMode nodeId="n1" onClose={onClose} />)
    const dialog = document.querySelector('[data-testid="writing-mode"]')
    expect(dialog).not.toBeNull()
    // Canvas-area modal semantics mirroring ReviewMode: the dialog element is
    // the writing surface, the Inspector stays visible docked on the right.
    expect(dialog?.getAttribute('role')).toBe('dialog')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    // Header keeps ONLY the close X: no pill, no breadcrumb, no word count.
    expect(document.querySelector('[data-testid="writing-mode-words"]')).toBeNull()
    expect(document.body.textContent).not.toContain(en.writing.snippetsMenu)
    // The H1 title carries the node name.
    const title = document.querySelector('[data-testid="writing-mode-title"]')
    expect(title?.tagName).toBe('H1')
    expect(title?.textContent).toBe('Understanding')
    // CloseButton renders its own <button> inside the testid wrapper span.
    const closeButton = document.querySelector<HTMLButtonElement>(
      '[data-testid="writing-mode-close"] button',
    )
    if (closeButton === null) throw new Error('close button not rendered')
    closeButton.click()
    expect(onClose).toHaveBeenCalled()
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
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
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

  it('ignores Escape when the event was already consumed (defaultPrevented)', async () => {
    const onClose = vi.fn()
    await renderUI(<WritingMode nodeId="n1" onClose={onClose} />)
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    event.preventDefault()
    window.dispatchEvent(event)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('flushes pending notes to the store BEFORE saveCurrentGraph snapshots it', async () => {
    // Capture the store's notes at the moment the save fires.
    const seenAtSave: string[] = []
    const saveSpy = vi.fn(async () => {
      const n = useGraphStore.getState().nodes.find((x) => x.id === 'n1')
      seenAtSave.push(JSON.stringify(n?.data.elaboration?.notes ?? null))
    })
    useGraphStore.setState({ saveCurrentGraph: saveSpy })
    await renderUI(<WritingMode nodeId="n1" onClose={() => {}} />)
    typeIntoEditor(' flushed text')
    await unmountUI()
    // The flush landed in the store...
    const stored = useGraphStore.getState().nodes.find((x) => x.id === 'n1')
    expect(JSON.stringify(stored?.data.elaboration?.notes)).toContain('flushed text')
    // ...and the save ran exactly once, snapshotting the flushed notes.
    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(seenAtSave[0]).toContain('flushed text')
  })

  it('commits flushed notes with the definition current in the store at commit time', async () => {
    // Snapshot the FULL node in the store at the moment the save fires.
    let nodeAtSave: unknown = null
    const saveSpy = vi.fn(async () => {
      nodeAtSave = structuredClone(
        useGraphStore.getState().nodes.find((x) => x.id === 'n1') ?? null,
      )
    })
    useGraphStore.setState({ saveCurrentGraph: saveSpy })
    await renderUI(<WritingMode nodeId="n1" onClose={() => {}} />)
    typeIntoEditor(' more')
    // The definition changes (e.g. synced edit) immediately before unmount —
    // with NO rerender in between, so a definition captured at render time
    // would commit the stale value; only a commit-time store read can see it.
    useGraphStore.setState({
      nodes: useGraphStore.getState().nodes.map((n) =>
        n.id === 'n1'
          ? {
              ...n,
              data: {
                ...n.data,
                elaboration: { definition: 'updated elsewhere', notes: notes('some words') },
              },
            }
          : n,
      ),
    })
    await unmountUI()
    const expectedNode = {
      id: 'n1',
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
          definition: 'updated elsewhere',
          notes: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'some words more' }] }],
          },
        },
      },
    }
    // The save ran exactly once, snapshotting the updated definition AND the
    // flushed notes.
    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(nodeAtSave).toEqual(expectedNode)
    expect(useGraphStore.getState().nodes).toEqual([expectedNode])
  })

  it('drops the pending flush when the node is deleted while writing', async () => {
    const onClose = vi.fn()
    await renderUI(<WritingMode nodeId="n1" onClose={onClose} />)
    typeIntoEditor(' doomed')
    useGraphStore.setState({ nodes: [] })
    await tick()
    // The overlay disappears with the node...
    expect(document.querySelector('[data-testid="writing-mode"]')).toBeNull()
    // ...and the unmount flush must not resurrect it: the node array stays
    // completely empty after the flush/save cycle.
    await unmountUI()
    expect(useGraphStore.getState().nodes).toEqual([])
  })
})
