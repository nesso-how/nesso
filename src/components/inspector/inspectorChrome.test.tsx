// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '@/store'
import { InspectorActionToolbar } from './inspectorChrome'

let container: HTMLDivElement | null = null
let root: Root | null = null

function selectEdgeOfType(type: string) {
  useGraphStore.setState({
    nodes: [],
    edges: [{ id: 'e1', source: 'a', target: 'b', type: 'nesso', data: { type } }],
    selected: { kind: 'edge', id: 'e1' },
  })
}

async function renderToolbar() {
  await act(async () => {
    root?.render(<InspectorActionToolbar />)
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

describe('InspectorActionToolbar', () => {
  it('offers Flip direction for a directed relation', async () => {
    selectEdgeOfType('causes')
    await renderToolbar()
    expect(container?.querySelector('[title="Flip direction"]')).not.toBeNull()
  })

  it('hides Flip direction for a symmetric relation', async () => {
    selectEdgeOfType('similar-to')
    await renderToolbar()
    expect(container?.querySelector('[title="Flip direction"]')).toBeNull()
    expect(container?.querySelector('[title="Delete relation"]')).not.toBeNull()
  })

  it('keeps copy/cut/duplicate for a node selection', async () => {
    useGraphStore.setState({ selected: { kind: 'node', id: 'n1' } })
    await renderToolbar()
    expect(container?.querySelector('[title^="Copy"]')).not.toBeNull()
    expect(container?.querySelector('[title="Flip direction"]')).toBeNull()
  })
})
