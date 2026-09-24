// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'
import type { Node } from '@xyflow/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '@/store'
import { defaultConceptReviewFields, type ConceptNodeData } from '@/types/graph'
import en from '@/i18n/locales/en'
import { NodeInspector } from './NodeInspector'

let container: HTMLDivElement | null = null
let root: Root | null = null

class TestResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}

  observe(_target: Element): void {}

  disconnect(): void {}

  unobserve(_target: Element): void {}
}

function conceptNode(): Node<ConceptNodeData> {
  return {
    id: 'n1',
    type: 'concept',
    position: { x: 0, y: 0 },
    data: {
      text: 'Understanding',
      ...defaultConceptReviewFields(),
      elaboration: { definition: 'A definition.' },
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', TestResizeObserver)
  useGraphStore.setState({
    nodes: [conceptNode()],
    edges: [],
    selected: { kind: 'node', id: 'n1' },
    writingModeNodeId: null,
    settings: {
      ...useGraphStore.getState().settings,
      inspectorMemoryOpen: false,
      inspectorRelationsOpen: false,
      language: 'en',
    },
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  vi.unstubAllGlobals()
  root?.unmount()
  root = null
  container?.remove()
  container = null
})

describe('NodeInspector elaboration section', () => {
  it('renders the elaboration section with inline editor, toggle, and themed Open note button', async () => {
    await act(async () => {
      root?.render(<NodeInspector panelWidth={320} onPanelWidthChange={vi.fn()} />)
    })

    const section = container?.querySelector('[data-testid="inspector-elaboration-section"]')
    if (!section) throw new Error('elaboration section not rendered')

    const inline = section.querySelector('[data-testid="inspector-notes-inline"]')
    if (!inline) throw new Error('inline notes editor not rendered')
    expect(inline.querySelector('.ProseMirror')).not.toBeNull()

    const button = section.querySelector<HTMLButtonElement>('[data-testid="inspector-notes-write"]')
    if (!button) throw new Error('open note button not rendered')
    expect(button.textContent).toBe(en.inspector.notes.openNote)
    expect(button.style.width).toBe('100%')
    expect(button.style.borderRadius).toBe('var(--radius-sm)')
    expect(button.style.border).toBe('0.5px solid var(--line)')
    expect(button.style.padding).toBe('var(--space-2) var(--space-5)')
    expect(button.style.fontSize).toBe('12.5px')
    expect(button.style.fontWeight).toBe('var(--font-weight-medium)')
    expect(button.style.fontFamily).toBe('var(--font-sans)')

    expect(button.classList.contains('inspector-notes-write')).toBe(true)

    await act(async () => {
      button.click()
    })
    expect(useGraphStore.getState().writingModeNodeId).toBe('n1')
    // Exactly one live editor: the inline instance unmounts while the dialog is open.
    expect(section.querySelector('[data-testid="inspector-notes-inline"]')).toBeNull()
  })

  it('collapses and expands through a persisted settings toggle', async () => {
    await act(async () => {
      root?.render(<NodeInspector panelWidth={320} onPanelWidthChange={vi.fn()} />)
    })
    const section = container?.querySelector('[data-testid="inspector-elaboration-section"]')
    if (!section) throw new Error('elaboration section not rendered')

    const header = section.querySelector<HTMLButtonElement>(':scope > button')
    if (!header) throw new Error('elaboration header not rendered')
    expect(header.textContent).toContain(en.inspector.notes.elaboration)

    // Collapsed: body unmounts (inline editor gone), setting persists.
    await act(async () => {
      header.click()
    })
    expect(useGraphStore.getState().settings.inspectorElaborationOpen).toBe(false)
    expect(section.querySelector('[data-testid="inspector-notes-inline"]')).toBeNull()

    // Expanded again: body returns.
    await act(async () => {
      header.click()
    })
    expect(useGraphStore.getState().settings.inspectorElaborationOpen).toBe(true)
    expect(section.querySelector('[data-testid="inspector-notes-inline"]')).not.toBeNull()
  })
})
