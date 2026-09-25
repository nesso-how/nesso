// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '@/store'
import { GraphContextMenu } from './GraphContextMenu'

let container: HTMLDivElement | null = null
let root: Root | null = null

function selectEdgeOfType(type: string) {
  useGraphStore.setState({
    nodes: [],
    edges: [{ id: 'e1', source: 'a', target: 'b', type: 'nesso', data: { type } }],
    selected: { kind: 'edge', id: 'e1' },
  })
}

async function renderEdgeMenu() {
  await act(async () => {
    root?.render(
      <GraphContextMenu menu={{ x: 0, y: 0, kind: 'edge' }} onClose={vi.fn()} onFit={vi.fn()} />,
    )
  })
}

beforeEach(() => {
  useGraphStore.setState({
    nodes: [],
    edges: [],
    selected: null,
    settings: {
      ...useGraphStore.getState().settings,
      language: 'en',
    },
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  root?.unmount()
  root = null
  container?.remove()
  container = null
})

describe('GraphContextMenu', () => {
  it('offers Flip direction for a directed relation', async () => {
    selectEdgeOfType('causes')
    await renderEdgeMenu()
    expect(container?.textContent).toContain('Flip direction')
    expect(container?.textContent).toContain('Delete')
  })

  it('hides Flip direction for a symmetric relation', async () => {
    selectEdgeOfType('contrasts-with')
    await renderEdgeMenu()
    expect(container?.textContent).not.toContain('Flip direction')
    expect(container?.textContent).toContain('Delete')
  })
})
