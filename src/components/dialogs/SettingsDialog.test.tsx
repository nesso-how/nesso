// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '@/store'
import { checkEndpoint, listEndpointModels } from '@/llm/completion'
import { SettingsDialog } from './SettingsDialog'

vi.mock('@/llm/completion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/llm/completion')>()
  return {
    ...actual,
    checkEndpoint: vi.fn().mockResolvedValue('available'),
    executeModelPull: vi.fn().mockResolvedValue(true),
    listEndpointModels: vi.fn().mockResolvedValue([]),
  }
})

let root: Root | null = null
let container: HTMLDivElement | null = null

function setupSettings(
  overrides: Partial<{ aiBaseUrl: string; aiModel: string; aiApiKey: string }>,
) {
  const s = useGraphStore.getState()
  useGraphStore.setState({
    settings: {
      ...s.settings,
      language: 'en',
      mentorEnabled: true,
      aiBaseUrl: 'http://localhost:11434/v1',
      aiModel: 'qwen3:8b',
      aiApiKey: '',
      ...overrides,
    },
  })
}

async function openAiTab(): Promise<void> {
  await act(async () => {
    root!.render(<SettingsDialog open onClose={() => {}} />)
  })
  const aiTab = [...container!.querySelectorAll('button')].find((b) => b.textContent === 'AI')
  if (!aiTab) throw new Error('AI tab button not found')
  await act(async () => {
    aiTab.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  // Flush the mocked /models fetch so discovered chips render.
  await act(async () => {})
}

function chipButton(label: string): HTMLButtonElement {
  const found = [...container!.querySelectorAll('button')].find((b) => b.textContent === label)
  if (!found) throw new Error(`chip button "${label}" not found`)
  return found as HTMLButtonElement
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount()
    })
    root = null
  }
  if (container) {
    container.remove()
    container = null
  }
  vi.clearAllMocks()
})

describe('SettingsDialog AI model discovery', () => {
  it('shows discovered endpoint models with no hardcoded presets for localhost', async () => {
    vi.mocked(listEndpointModels).mockResolvedValue(['discovered-local-a', 'discovered-local-b'])
    setupSettings({ aiBaseUrl: 'http://localhost:11434/v1', aiModel: 'discovered-local-a' })
    await openAiTab()
    expect(container!.textContent).toContain('discovered-local-a')
    expect(container!.textContent).toContain('discovered-local-b')
    expect(container!.textContent).not.toContain('llama3.2:3b')
    expect(container!.textContent).not.toContain('qwen3:8b')
  })

  it('shows discovered models for a remote endpoint', async () => {
    vi.mocked(listEndpointModels).mockResolvedValue(['big-pickle'])
    setupSettings({
      aiBaseUrl: 'https://opencode.ai/zen/v1',
      aiModel: 'big-pickle',
      aiApiKey: 'test-key',
    })
    await openAiTab()
    expect(container!.textContent).toContain('big-pickle')
    expect(container!.textContent).not.toContain('llama3.2:3b')
    expect(container!.textContent).not.toContain('qwen3:8b')
  })

  it('keeps the custom model input editable alongside discovered models', async () => {
    vi.mocked(listEndpointModels).mockResolvedValue(['discovered-local-a'])
    setupSettings({ aiBaseUrl: 'http://localhost:11434/v1', aiModel: 'discovered-local-a' })
    await openAiTab()
    const input = container!.querySelector('input[placeholder="e.g. qwen3:8b"]')
    expect(input).not.toBeNull()
  })

  it('selecting a discovered model updates the model and re-checks it', async () => {
    vi.mocked(listEndpointModels).mockResolvedValue(['discovered-local-a', 'discovered-local-b'])
    setupSettings({ aiBaseUrl: 'http://localhost:11434/v1', aiModel: 'discovered-local-a' })
    await openAiTab()
    await act(async () => {
      chipButton('discovered-local-b').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(useGraphStore.getState().settings.aiModel).toBe('discovered-local-b')
    expect(vi.mocked(checkEndpoint)).toHaveBeenCalledWith(
      'http://localhost:11434/v1',
      'discovered-local-b',
      '',
      expect.anything(),
    )
  })

  it('falls back to the bare input when discovery returns nothing', async () => {
    vi.mocked(listEndpointModels).mockResolvedValue([])
    setupSettings({ aiBaseUrl: 'http://localhost:11434/v1', aiModel: 'custom-model' })
    await openAiTab()
    expect(container!.querySelector('input[placeholder="e.g. qwen3:8b"]')).not.toBeNull()
    expect(container!.textContent).not.toContain('llama3.2:3b')
  })
})
