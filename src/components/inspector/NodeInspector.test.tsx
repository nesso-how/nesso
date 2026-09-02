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

describe('NodeInspector notes action', () => {
  it('renders Notes as a compact action row with a themed Write button', async () => {
    await act(async () => {
      root?.render(<NodeInspector panelWidth={320} onPanelWidthChange={vi.fn()} />)
    })

    const section = container?.querySelector('[data-testid="inspector-notes-section"]')
    if (!section) throw new Error('notes section not rendered')
    expect(section.children).toHaveLength(1)

    const label = section.querySelector('[data-testid="inspector-notes-label"]')
    expect(label?.textContent).toBe(en.inspector.notes.section)
    expect(label?.getAttribute('style')).not.toContain('text-transform: uppercase')
    expect(label?.getAttribute('style')).toContain('var(--font-sans)')

    const button = section.querySelector<HTMLButtonElement>('[data-testid="inspector-notes-write"]')
    if (!button) throw new Error('write button not rendered')
    expect(button.textContent).toBe(en.inspector.notes.write)
    expect(button.style.borderRadius).toBe('var(--radius-sm)')
    expect(button.style.border).toBe('0.5px solid var(--line)')
    expect(button.style.padding).toBe('var(--space-2) var(--space-5)')
    expect(button.style.fontSize).toBe('var(--text-sm)')
    expect(button.style.fontWeight).toBe('var(--font-weight-medium)')
    expect(button.style.fontFamily).toBe('var(--font-sans)')

    expect(button.classList.contains('inspector-notes-write')).toBe(true)

    await act(async () => {
      button.click()
    })
    expect(useGraphStore.getState().writingModeNodeId).toBe('n1')
  })
})
