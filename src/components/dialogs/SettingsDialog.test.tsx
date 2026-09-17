// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '@/store'
import { checkEndpoint, isOllamaNative, listEndpointModels } from '@/llm/completion'
import { SettingsDialog } from './SettingsDialog'

vi.mock('@/llm/completion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/llm/completion')>()
  return {
    ...actual,
    checkEndpoint: vi.fn().mockResolvedValue('available'),
    executeModelPull: vi.fn().mockResolvedValue(true),
    listEndpointModels: vi.fn().mockResolvedValue([]),
    isOllamaNative: vi.fn().mockResolvedValue(true),
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
  // Flush the mocked /models fetch so discovered options render.
  await act(async () => {})
}

function selectToggle(): HTMLButtonElement {
  const toggles = [...container!.querySelectorAll('button')].filter((b) => b.querySelector('svg'))
  if (toggles.length !== 1)
    throw new Error(`expected exactly one select toggle, found ${toggles.length}`)
  return toggles[0] as HTMLButtonElement
}

async function openModelSelect(): Promise<void> {
  await act(async () => {
    selectToggle().dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function selectOption(label: string): HTMLButtonElement {
  const found = [...container!.querySelectorAll('button')].find((b) => b.textContent === label)
  if (!found) throw new Error(`select option "${label}" not found`)
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
  it('lists discovered endpoint models in a select with no hardcoded presets', async () => {
    vi.mocked(listEndpointModels).mockResolvedValue(['discovered-local-a', 'discovered-local-b'])
    setupSettings({ aiBaseUrl: 'http://localhost:11434/v1', aiModel: 'discovered-local-a' })
    await openAiTab()
    await openModelSelect()
    expect(container!.textContent).toContain('discovered-local-a')
    expect(container!.textContent).toContain('discovered-local-b')
    expect(container!.textContent).not.toContain('llama3.2:3b')
    expect(container!.textContent).not.toContain('qwen3:8b')
  })

  it('lists discovered models in a select for a remote endpoint', async () => {
    vi.mocked(listEndpointModels).mockResolvedValue(['big-pickle'])
    setupSettings({
      aiBaseUrl: 'https://opencode.ai/zen/v1',
      aiModel: 'big-pickle',
      aiApiKey: 'test-key',
    })
    await openAiTab()
    await openModelSelect()
    expect(container!.textContent).toContain('big-pickle')
    expect(container!.textContent).not.toContain('llama3.2:3b')
    expect(container!.textContent).not.toContain('qwen3:8b')
  })

  it('offers a Custom option inside the select instead of a separate button', async () => {
    vi.mocked(listEndpointModels).mockResolvedValue(['discovered-local-a'])
    setupSettings({ aiBaseUrl: 'http://localhost:11434/v1', aiModel: 'discovered-local-a' })
    await openAiTab()
    // Input hidden, and no standalone custom button anywhere.
    expect(container!.querySelector('input[placeholder="e.g. qwen3:8b"]')).toBeNull()
    expect(
      [...container!.querySelectorAll('button')].some((b) => b.textContent === 'Custom…'),
    ).toBe(false)
    await openModelSelect()
    expect(selectOption('Custom…')).not.toBeNull()
  })

  it('selecting Custom reveals the input without changing the model', async () => {
    vi.mocked(listEndpointModels).mockResolvedValue(['discovered-local-a', 'discovered-local-b'])
    setupSettings({ aiBaseUrl: 'http://localhost:11434/v1', aiModel: 'discovered-local-a' })
    await openAiTab()
    await openModelSelect()
    await act(async () => {
      selectOption('Custom…').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(useGraphStore.getState().settings.aiModel).toBe('discovered-local-a')
    expect(container!.querySelector('input[placeholder="e.g. qwen3:8b"]')).not.toBeNull()
  })

  it('hides the input again after picking a discovered model', async () => {
    vi.mocked(listEndpointModels).mockResolvedValue(['discovered-local-a', 'discovered-local-b'])
    setupSettings({ aiBaseUrl: 'http://localhost:11434/v1', aiModel: 'my-custom-model' })
    await openAiTab()
    // Custom value forces the input visible.
    expect(container!.querySelector('input[placeholder="e.g. qwen3:8b"]')).not.toBeNull()
    await openModelSelect()
    await act(async () => {
      selectOption('discovered-local-b').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(useGraphStore.getState().settings.aiModel).toBe('discovered-local-b')
    expect(container!.querySelector('input[placeholder="e.g. qwen3:8b"]')).toBeNull()
  })

  it('selecting a discovered model updates the model and re-checks it', async () => {
    vi.mocked(listEndpointModels).mockResolvedValue(['discovered-local-a', 'discovered-local-b'])
    setupSettings({ aiBaseUrl: 'http://localhost:11434/v1', aiModel: 'discovered-local-a' })
    await openAiTab()
    await openModelSelect()
    await act(async () => {
      selectOption('discovered-local-b').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(useGraphStore.getState().settings.aiModel).toBe('discovered-local-b')
    expect(vi.mocked(checkEndpoint)).toHaveBeenCalledWith(
      'http://localhost:11434/v1',
      'discovered-local-b',
      '',
      expect.anything(),
    )
  })

  it('shows a custom model typed outside the discovered list', async () => {
    vi.mocked(listEndpointModels).mockResolvedValue(['discovered-local-a'])
    setupSettings({ aiBaseUrl: 'http://localhost:11434/v1', aiModel: 'my-custom-model' })
    await openAiTab()
    // The select still displays the current value even when it is not discovered.
    expect(selectToggle().textContent).toContain('my-custom-model')
    expect(container!.querySelector('input[placeholder="e.g. qwen3:8b"]')).not.toBeNull()
  })

  it('defaults an empty model to the first discovered model', async () => {
    vi.mocked(listEndpointModels).mockResolvedValue(['discovered-local-a', 'discovered-local-b'])
    setupSettings({ aiBaseUrl: 'http://localhost:11434/v1', aiModel: '' })
    await openAiTab()
    expect(useGraphStore.getState().settings.aiModel).toBe('discovered-local-a')
    // Defaulted value is discovered, so the select shows it and the input stays hidden.
    expect(selectToggle().textContent).toContain('discovered-local-a')
    expect(container!.querySelector('input[placeholder="e.g. qwen3:8b"]')).toBeNull()
  })

  it('falls back to the bare input when discovery returns nothing', async () => {
    vi.mocked(listEndpointModels).mockResolvedValue([])
    setupSettings({ aiBaseUrl: 'http://localhost:11434/v1', aiModel: 'custom-model' })
    await openAiTab()
    expect(container!.querySelector('input[placeholder="e.g. qwen3:8b"]')).not.toBeNull()
    expect(container!.textContent).not.toContain('llama3.2:3b')
    expect(
      [...container!.querySelectorAll('button')].filter((b) => b.querySelector('svg')),
    ).toHaveLength(0)
  })

  it('offers Pull for an unavailable model on a proven Ollama endpoint', async () => {
    vi.mocked(listEndpointModels).mockResolvedValue(['llama3.2:3b'])
    vi.mocked(checkEndpoint).mockResolvedValue('unavailable')
    vi.mocked(isOllamaNative).mockResolvedValue(true)
    setupSettings({ aiBaseUrl: 'http://localhost:11434/v1', aiModel: 'qwen3:8b' })
    await openAiTab()
    expect(container!.textContent).toContain('Not found locally')
    expect(container!.textContent).toContain('Pull')
  })

  it('hides Pull with neutral text on a proven non-Ollama endpoint', async () => {
    vi.mocked(listEndpointModels).mockResolvedValue(['unsloth/Qwen3.5-9B-GGUF'])
    vi.mocked(checkEndpoint).mockResolvedValue('unavailable')
    vi.mocked(isOllamaNative).mockResolvedValue(false)
    setupSettings({ aiBaseUrl: 'http://127.0.0.1:8888/v1', aiModel: 'unknown-model' })
    await openAiTab()
    expect(container!.textContent).toContain('Model not found')
    expect(container!.textContent).not.toContain('Pull')
  })

  it('shows unauthorized immediately on URL entry with an empty model', async () => {
    vi.mocked(listEndpointModels).mockResolvedValue([])
    vi.mocked(checkEndpoint).mockResolvedValue('unauthorized')
    vi.mocked(isOllamaNative).mockResolvedValue(false)
    setupSettings({ aiBaseUrl: 'http://127.0.0.1:8888/v1', aiModel: '' })
    await openAiTab()
    expect(container!.textContent).toContain('Unauthorized')
  })
})
