// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockTrack,
  mockDeserialize,
  mockSerialize,
  mockDocumentToGraph,
  mockGraphToDocument,
  mockExportShareGraphJson,
  mockGetState,
  mockToPng,
} = vi.hoisted(() => ({
  mockTrack: vi.fn(),
  mockDeserialize: vi.fn(),
  mockSerialize: vi.fn(),
  mockDocumentToGraph: vi.fn(),
  mockGraphToDocument: vi.fn(),
  mockExportShareGraphJson: vi.fn(),
  mockGetState: vi.fn(),
  mockToPng: vi.fn(),
}))

vi.mock('@/telemetry', () => ({ track: mockTrack }))

vi.mock('@nesso-how/vocab-learning', () => ({
  deserialize: mockDeserialize,
  serialize: mockSerialize,
}))

vi.mock('@/lib/graphMapping', () => ({
  documentToGraph: mockDocumentToGraph,
}))

vi.mock('@/lib/graphDocumentMapping', () => ({
  graphToDocument: mockGraphToDocument,
}))

vi.mock('@/lib/saveJsonFile', () => ({
  exportShareGraphJson: mockExportShareGraphJson,
}))

vi.mock('@/store', () => ({
  useGraphStore: { getState: mockGetState },
}))

vi.mock('@/i18n', () => ({
  getT: vi.fn(() => ({ graphIO: { importError: 'Failed to import {name}' } })),
}))

vi.mock('@/components/ui/toast', () => ({
  toast: { error: vi.fn() },
}))

vi.mock('@xyflow/react', () => ({
  getNodesBounds: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 100 })),
  getViewportForBounds: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
}))

vi.mock('html-to-image', () => ({
  toPng: mockToPng,
}))

import { importGraphFromFile, exportGraphJson, exportGraphPng } from './graphIO'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('importGraphFromFile', () => {
  it('emits graph_imported on success', async () => {
    mockDeserialize.mockReturnValueOnce({ name: 'test', id: 'g-1' })
    mockDocumentToGraph.mockResolvedValueOnce({
      nodes: [],
      edges: [],
      display: {},
    })

    const importGraph = vi.fn().mockResolvedValue(undefined)
    mockGetState.mockReturnValueOnce({ importGraph })

    const file = new File(['{}'], 'test.json', { type: 'application/json' })
    await importGraphFromFile(file)

    expect(mockTrack).toHaveBeenCalledWith({ name: 'graph_imported' })
  })

  it('emits graph_import_failed with reason invalid_file when deserialize throws SyntaxError', async () => {
    mockDeserialize.mockImplementationOnce(() => {
      throw new SyntaxError('Unexpected token at line 42')
    })

    const file = new File(['corrupt content'], 'test.json', { type: 'application/json' })

    await expect(importGraphFromFile(file)).rejects.toThrow()

    expect(mockTrack).toHaveBeenCalledWith({
      name: 'graph_import_failed',
      props: { format: 'json', reason: 'invalid_file' },
    })
    expect(mockTrack).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'graph_imported' }))
    // Track payload must not include error details or file content.
    const payload = JSON.stringify(mockTrack.mock.calls.at(-1)![0])
    expect(payload).not.toContain('Unexpected token')
    expect(payload).not.toContain('corrupt')
  })

  it('emits graph_import_failed with reason unsupported when documentToGraph throws', async () => {
    mockDeserialize.mockReturnValueOnce({ name: 'test', id: 'g-1' })
    mockDocumentToGraph.mockRejectedValueOnce(new Error('Validation failed'))

    const file = new File(['{}'], 'test.json', { type: 'application/json' })

    await expect(importGraphFromFile(file)).rejects.toThrow()

    expect(mockTrack).toHaveBeenCalledWith({
      name: 'graph_import_failed',
      props: { format: 'json', reason: 'unsupported' },
    })
  })
})

describe('exportGraphJson', () => {
  const storeState = {
    nodes: [],
    edges: [],
    graphList: [{ id: 'g-1', name: 'test' }],
    currentGraphId: 'g-1',
    graphDisplay: {},
  }

  beforeEach(() => {
    mockGraphToDocument.mockReturnValue({})
    mockSerialize.mockReturnValue('{"serialized":true}')
  })

  it('emits graph_exported on success', async () => {
    mockGetState.mockReturnValueOnce(storeState)
    mockExportShareGraphJson.mockResolvedValueOnce(undefined)

    await exportGraphJson()

    expect(mockTrack).toHaveBeenCalledWith({
      name: 'graph_exported',
      props: { format: 'json' },
    })
  })

  it('emits graph_export_failed with format json on exportShareGraphJson failure', async () => {
    mockGetState.mockReturnValueOnce(storeState)
    mockExportShareGraphJson.mockRejectedValueOnce(new Error('Permission denied: /path/to/file'))

    await expect(exportGraphJson()).rejects.toThrow()

    expect(mockTrack).toHaveBeenCalledWith({
      name: 'graph_export_failed',
      props: { format: 'json', reason: 'unsupported' },
    })
    expect(mockTrack).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'graph_exported' }))
    // Track payload must not include error messages or paths.
    const payload = JSON.stringify(mockTrack.mock.calls.at(-1)![0])
    expect(payload).not.toContain('Permission denied')
    expect(payload).not.toContain('/path/to/file')
  })

  it('emits graph_export_failed when serialize throws', async () => {
    mockGetState.mockReturnValueOnce(storeState)
    mockSerialize.mockImplementationOnce(() => {
      throw new Error('serialization error')
    })

    await expect(exportGraphJson()).rejects.toThrow()

    expect(mockTrack).toHaveBeenCalledWith({
      name: 'graph_export_failed',
      props: { format: 'json', reason: 'unsupported' },
    })
    expect(mockTrack).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'graph_exported' }))
  })
})

describe('exportGraphPng', () => {
  const storeState = {
    nodes: [{ id: 'n1', position: { x: 0, y: 0 } }],
    graphList: [{ id: 'g-1', name: 'test' }],
    currentGraphId: 'g-1',
  }

  it('emits graph_export_failed with format png when toPng throws', async () => {
    mockGetState.mockReturnValueOnce(storeState)
    const viewport = document.createElement('div')
    viewport.className = 'react-flow__viewport'
    document.body.appendChild(viewport)

    mockToPng.mockRejectedValueOnce(new Error('canvas rendering failed: out of memory'))

    await expect(exportGraphPng()).rejects.toThrow('canvas rendering failed')

    expect(mockTrack).toHaveBeenCalledWith({
      name: 'graph_export_failed',
      props: { format: 'png', reason: 'unsupported' },
    })
    expect(mockTrack).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'graph_exported' }))
    // Track payload must not include error details.
    const payload = JSON.stringify(mockTrack.mock.calls.at(-1)![0])
    expect(payload).not.toContain('canvas rendering')
    expect(payload).not.toContain('out of memory')

    document.body.removeChild(viewport)
  })

  it('re-throws the error so callers can surface the failure', async () => {
    mockGetState.mockReturnValueOnce(storeState)
    const viewport = document.createElement('div')
    viewport.className = 'react-flow__viewport'
    document.body.appendChild(viewport)

    mockToPng.mockRejectedValueOnce(new Error('canvas error'))

    await expect(exportGraphPng()).rejects.toThrow('canvas error')

    expect(mockTrack).toHaveBeenCalledWith({
      name: 'graph_export_failed',
      props: { format: 'png', reason: 'unsupported' },
    })

    document.body.removeChild(viewport)
  })

  it('returns early without tracking when viewport is missing', async () => {
    mockGetState.mockReturnValueOnce({ ...storeState, nodes: [] })

    await exportGraphPng()

    expect(mockTrack).not.toHaveBeenCalled()
  })
})
