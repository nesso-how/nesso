// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'

// Suppress act() warnings in React 18 jsdom tests without @testing-library/react.
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { NoSuchToolError } from 'ai'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '@/store'
import { defaultConceptReviewFields } from '@/types/graph'
import { MentorPanel } from './MentorPanel'

const { mockTrack } = vi.hoisted(() => ({
  mockTrack: vi.fn(),
}))

vi.mock('@/telemetry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/telemetry')>()
  return { ...actual, track: mockTrack }
})

const { mockFetchCompletion } = vi.hoisted(() => ({
  mockFetchCompletion: vi.fn(),
}))

const { mockBuildLegacyMentorPrompt } = vi.hoisted(() => ({
  mockBuildLegacyMentorPrompt: vi.fn(),
}))

vi.mock('@/llm/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/llm/context')>()
  return { ...actual, buildLegacyMentorPrompt: mockBuildLegacyMentorPrompt }
})

vi.mock('@/llm/completion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/llm/completion')>()
  return {
    ...actual,
    fetchCompletion: mockFetchCompletion,
    isAiReady: vi.fn().mockReturnValue(true),
    describeCompletionError: vi.fn().mockReturnValue('Test error'),
    isNetworkFailure: vi.fn().mockReturnValue(false),
  }
})

let root: Root | null = null
let container: HTMLDivElement | null = null

function setupStore() {
  // Ensure the store has default settings with a valid AI endpoint so isAiReady → true.
  const s = useGraphStore.getState()
  useGraphStore.setState({
    nodes: [],
    edges: [],
    selected: null,
    selectedIds: [],
    editNodeId: null,
    mentorPanelExpanded: true,
    currentGraphId: 'test-graph-1',
    settings: {
      ...s.settings,
      aiBaseUrl: 'http://localhost:11434/v1',
      aiModel: 'gemma3:4b',
      language: 'en',
    },
  })
}

async function sendMessage(text: string): Promise<void> {
  const textarea = container!.querySelector('textarea')!
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )!.set!
  await act(async () => {
    nativeSetter.call(textarea, text)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => {
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  })
}

async function renderLegacyChat(): Promise<void> {
  mockFetchCompletion.mockImplementationOnce(async () => {
    throw new NoSuchToolError({ toolName: 'getGraphOverview' })
  })
  await act(async () => {
    root!.render(<MentorPanel leftInset={0} rightInset={0} />)
  })
  expect(mockFetchCompletion).toHaveBeenCalledTimes(2)
}

function concept(id: string, text: string, definition: string) {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { text, ...defaultConceptReviewFields(), elaboration: { definition } },
  }
}

beforeEach(() => {
  mockTrack.mockClear()
  mockFetchCompletion.mockClear()
  mockBuildLegacyMentorPrompt.mockClear()
  mockBuildLegacyMentorPrompt.mockReturnValue('Nodes: legacy snapshot')
  setupStore()

  // Mock fetchCompletion to resolve immediately so the LLM effect doesn't hang.
  // Call onToken to simulate a completed response so loadingInitial becomes false.
  mockFetchCompletion.mockImplementation(
    async (
      _settings: unknown,
      _request: unknown,
      _maxTokens: unknown,
      _signal: unknown,
      handlers: { onToken?: (delta: string) => void } | undefined,
    ) => {
      handlers?.onToken?.('Hello')
      return 'Hello'
    },
  )

  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  if (root) {
    root.unmount()
    root = null
  }
  if (container) {
    container.remove()
    container = null
  }
})

describe('MentorPanel telemetry', () => {
  it('does not emit session events when the panel closes with no user messages', async () => {
    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })

    await act(async () => {
      useGraphStore.getState().setMentorPanelExpanded(false)
    })

    const sessionEvents = mockTrack.mock.calls.filter((c: unknown[]) => {
      const name = (c[0] as { name: string }).name
      return name === 'mentor_session_abandoned' || name === 'mentor_session_completed'
    })
    expect(sessionEvents).toHaveLength(0)
  })

  it('does not emit session events on unmount with no user messages', async () => {
    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })

    await act(async () => {
      root!.unmount()
    })

    const sessionEvents = mockTrack.mock.calls.filter((c: unknown[]) => {
      const name = (c[0] as { name: string }).name
      return name === 'mentor_session_abandoned' || name === 'mentor_session_completed'
    })
    expect(sessionEvents).toHaveLength(0)
  })

  it('does not emit session events when the graph changes with no user messages', async () => {
    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })

    await act(async () => {
      useGraphStore.setState({ currentGraphId: 'test-graph-2' })
    })

    const sessionEvents = mockTrack.mock.calls.filter((c: unknown[]) => {
      const name = (c[0] as { name: string }).name
      return name === 'mentor_session_abandoned' || name === 'mentor_session_completed'
    })
    expect(sessionEvents).toHaveLength(0)
  })

  it('emits mentor_session_completed when user sends a message and gets a mentor reply before closing', async () => {
    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })

    // Type a message and press Enter to send it.
    const textarea = container!.querySelector('textarea')!
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )!.set!

    await act(async () => {
      nativeSetter.call(textarea, 'What is knowledge?')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })

    await act(async () => {
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })

    // Close the panel — the last message is the mentor reply.
    await act(async () => {
      useGraphStore.getState().setMentorPanelExpanded(false)
    })

    expect(mockTrack).toHaveBeenCalledWith({
      name: 'mentor_session_completed',
      props: { message_count_bucket: '1-2' },
    })
    expect(mockTrack).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'mentor_session_abandoned' }),
    )
  })

  it('emits mentor_session_abandoned when user sends a message and the reply errors out before closing', async () => {
    // First call (initial seed) succeeds normally.
    mockFetchCompletion.mockImplementationOnce(
      async (
        _settings: unknown,
        _request: unknown,
        _maxTokens: unknown,
        _signal: unknown,
        handlers: { onToken?: (delta: string) => void } | undefined,
      ) => {
        handlers?.onToken?.('Hello')
        return 'Hello'
      },
    )

    // Second call (user send) throws — the reply is an error message.
    mockFetchCompletion.mockImplementationOnce(async () => {
      throw new Error('Connection refused')
    })

    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })

    const textarea = container!.querySelector('textarea')!
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )!.set!

    await act(async () => {
      nativeSetter.call(textarea, 'Hello?')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })

    await act(async () => {
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })

    // Close the panel — the last message was an error from mentor, not a clean reply.
    await act(async () => {
      useGraphStore.getState().setMentorPanelExpanded(false)
    })

    expect(mockTrack).toHaveBeenCalledWith({
      name: 'mentor_session_abandoned',
      props: { message_count_bucket: '1-2' },
    })
    expect(mockTrack).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'mentor_session_completed' }),
    )
  })
})

describe('MentorPanel graph tools', () => {
  it('shows only the latest localized tool action until the first answer token', async () => {
    let handlers:
      | { onToken?: (delta: string) => void; onToolCall?: (name: string) => void }
      | undefined
    let resolveRequest!: (value: string) => void
    mockFetchCompletion.mockImplementationOnce(
      async (
        _settings: unknown,
        _request: unknown,
        _maxTokens: unknown,
        _signal: unknown,
        requestHandlers: typeof handlers,
      ) => {
        handlers = requestHandlers
        return new Promise<string>((resolve) => {
          resolveRequest = resolve
        })
      },
    )

    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })

    await act(async () => {
      handlers?.onToolCall?.('searchConcepts')
    })
    expect(container!.textContent).toContain('Searching concepts…')

    await act(async () => {
      handlers?.onToolCall?.('listNeighbors')
    })
    expect(container!.textContent).toContain('Following relations…')
    expect(container!.textContent).not.toContain('Searching concepts…')

    await act(async () => {
      handlers?.onToken?.('Answer')
    })
    expect(container!.textContent).not.toContain('Following relations…')

    await act(async () => {
      resolveRequest('Answer')
    })
  })

  it('uses the current locale for transient tool actions', async () => {
    let onToolCall: ((name: string) => void) | undefined
    let resolveRequest!: (value: string) => void
    useGraphStore.setState({
      settings: { ...useGraphStore.getState().settings, language: 'it' },
    })
    mockFetchCompletion.mockImplementationOnce(
      async (
        _settings: unknown,
        _request: unknown,
        _maxTokens: unknown,
        _signal: unknown,
        handlers: { onToolCall?: (name: string) => void } | undefined,
      ) => {
        onToolCall = handlers?.onToolCall
        return new Promise<string>((resolve) => {
          resolveRequest = resolve
        })
      },
    )

    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })
    await act(async () => {
      onToolCall?.('searchConcepts')
    })

    expect(container!.textContent).toContain('Cerco concetti…')

    await act(async () => {
      resolveRequest('Risposta')
    })
  })

  it('ignores unknown tool activity names instead of replacing a known action', async () => {
    let onToolCall: ((name: string) => void) | undefined
    let resolveRequest!: (value: string) => void
    mockFetchCompletion.mockImplementationOnce(
      async (
        _settings: unknown,
        _request: unknown,
        _maxTokens: unknown,
        _signal: unknown,
        handlers: { onToolCall?: (name: string) => void } | undefined,
      ) => {
        onToolCall = handlers?.onToolCall
        return new Promise<string>((resolve) => {
          resolveRequest = resolve
        })
      },
    )

    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })
    await act(async () => {
      onToolCall?.('searchConcepts')
    })
    await act(async () => {
      onToolCall?.('unknownTool')
    })
    await act(async () => {
      onToolCall?.('__proto__')
    })

    expect(container!.textContent).toContain('Searching concepts…')
    expect(container!.textContent).not.toContain('unknownTool')

    await act(async () => {
      resolveRequest('Answer')
    })
  })

  it('exposes current tool activity as a polite status and removes it when answering starts', async () => {
    let onToolCall: ((name: string) => void) | undefined
    let onToken: ((delta: string) => void) | undefined
    let resolveRequest!: (value: string) => void
    mockFetchCompletion.mockImplementationOnce(
      async (
        _settings: unknown,
        _request: unknown,
        _maxTokens: unknown,
        _signal: unknown,
        handlers:
          | {
              onToken?: (delta: string) => void
              onToolCall?: (name: string) => void
            }
          | undefined,
      ) => {
        onToolCall = handlers?.onToolCall
        onToken = handlers?.onToken
        return new Promise<string>((resolve) => {
          resolveRequest = resolve
        })
      },
    )

    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })
    await act(async () => {
      onToolCall?.('searchConcepts')
    })

    const status = container!.querySelector('[role="status"]')
    expect(status).not.toBeNull()
    expect(status?.getAttribute('aria-live')).toBe('polite')
    expect(status?.getAttribute('aria-atomic')).toBe('true')
    expect(status?.textContent).toContain('Searching concepts…')

    await act(async () => {
      onToken?.('Answer')
    })
    expect(container!.querySelector('[role="status"]')).toBeNull()

    await act(async () => {
      resolveRequest('Answer')
    })
  })

  it('keeps tool names, inputs, and results out of visible chat history', async () => {
    let handlers:
      | { onToken?: (delta: string) => void; onToolCall?: (name: string) => void }
      | undefined
    let resolveRequest!: (value: string) => void
    mockFetchCompletion.mockImplementationOnce(
      async (
        _settings: unknown,
        _request: unknown,
        _maxTokens: unknown,
        _signal: unknown,
        requestHandlers: typeof handlers,
      ) => {
        handlers = requestHandlers
        return new Promise<string>((resolve) => {
          resolveRequest = resolve
        })
      },
    )

    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })
    await act(async () => {
      handlers?.onToolCall?.('searchConcepts')
    })
    expect(container!.textContent).not.toContain('searchConcepts')
    expect(container!.textContent).not.toContain('{"query":"memory"}')

    await act(async () => {
      handlers?.onToken?.('Answer only')
      resolveRequest('Answer only')
    })

    expect(container!.textContent).toContain('Answer only')
    expect(container!.textContent).not.toContain('searchConcepts')
    expect(container!.textContent).not.toContain('{"query":"memory"}')
    expect(container!.textContent).not.toContain('{"matches":')
  })

  it('does not let an aborted request clear a newer request action', async () => {
    let firstHandlers:
      | { onToken?: (delta: string) => void; onToolCall?: (name: string) => void }
      | undefined
    let secondHandlers:
      | { onToken?: (delta: string) => void; onToolCall?: (name: string) => void }
      | undefined
    let resolveFirst!: (value: string) => void
    let resolveSecond!: (value: string) => void
    mockFetchCompletion.mockImplementationOnce(
      async (
        _settings: unknown,
        _request: unknown,
        _maxTokens: unknown,
        _signal: unknown,
        handlers: typeof firstHandlers,
      ) => {
        firstHandlers = handlers
        return new Promise<string>((resolve) => {
          resolveFirst = resolve
        })
      },
    )
    mockFetchCompletion.mockImplementationOnce(
      async (
        _settings: unknown,
        _request: unknown,
        _maxTokens: unknown,
        _signal: unknown,
        handlers: typeof secondHandlers,
      ) => {
        secondHandlers = handlers
        return new Promise<string>((resolve) => {
          resolveSecond = resolve
        })
      },
    )

    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })
    await sendMessage('First request')
    await act(async () => {
      firstHandlers?.onToolCall?.('searchConcepts')
      firstHandlers?.onToken?.('partial')
    })
    await sendMessage('Second request')
    await act(async () => {
      secondHandlers?.onToolCall?.('listNeighbors')
      firstHandlers?.onToolCall?.('searchConcepts')
      firstHandlers?.onToken?.('late text')
    })

    expect(container!.textContent).toContain('Following relations…')
    expect(container!.textContent).not.toContain('Searching concepts…')
    expect(container!.textContent).not.toContain('late text')

    await act(async () => {
      resolveFirst('late first reply')
      resolveSecond('second reply')
    })
  })

  it('clears the action before fallback and aborts the shared primary/fallback signal', async () => {
    let primarySignal: AbortSignal | undefined
    let fallbackSignal: AbortSignal | undefined
    let rejectPrimary!: (error: unknown) => void
    let resolveFallback!: (value: string) => void
    mockFetchCompletion.mockImplementationOnce(
      async (
        _settings: unknown,
        _request: unknown,
        _maxTokens: unknown,
        signal: AbortSignal,
        handlers: { onToolCall?: (name: string) => void } | undefined,
      ) => {
        primarySignal = signal
        handlers?.onToolCall?.('searchConcepts')
        return new Promise<string>((_resolve, reject) => {
          rejectPrimary = reject
        })
      },
    )
    mockFetchCompletion.mockImplementationOnce(
      async (_settings: unknown, _request: unknown, _maxTokens: unknown, signal: AbortSignal) => {
        fallbackSignal = signal
        return new Promise<string>((resolve) => {
          resolveFallback = resolve
        })
      },
    )

    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })
    await sendMessage('Try the fallback')
    expect(container!.textContent).toContain('Searching concepts…')

    await act(async () => {
      rejectPrimary(new NoSuchToolError({ toolName: 'getGraphOverview' }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container!.textContent).not.toContain('Searching concepts…')
    expect(fallbackSignal).toBe(primarySignal)

    const closeButton = container!.querySelectorAll('button')[1]!
    await act(async () => {
      closeButton.click()
    })
    expect(primarySignal?.aborted).toBe(true)

    await act(async () => {
      resolveFallback('late fallback reply')
      await Promise.resolve()
    })
    expect(container!.textContent).not.toContain('late fallback reply')
  })

  it('retries an incompatible opener once in legacy mode and keeps later turns legacy', async () => {
    mockBuildLegacyMentorPrompt.mockReturnValue('Nodes: legacy snapshot')
    mockFetchCompletion.mockImplementationOnce(async () => {
      throw new NoSuchToolError({ toolName: 'getGraphOverview' })
    })

    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })

    expect(mockFetchCompletion).toHaveBeenCalledTimes(2)
    expect(mockFetchCompletion.mock.calls[1][3]).toBe(mockFetchCompletion.mock.calls[0][3])
    expect(mockFetchCompletion.mock.calls[1][1]).toMatchObject({
      instructions: 'Nodes: legacy snapshot',
    })
    expect(mockFetchCompletion.mock.calls[1][1]).not.toHaveProperty('tools')

    await sendMessage('Keep using the snapshot')

    expect(mockFetchCompletion.mock.calls[2][1]).toMatchObject({
      instructions: 'Nodes: legacy snapshot',
    })
    expect(mockFetchCompletion.mock.calls[2][1]).not.toHaveProperty('tools')
  })

  it('does not retry after the first visible token', async () => {
    mockFetchCompletion.mockImplementationOnce(
      async (
        _settings: unknown,
        _request: unknown,
        _maxTokens: unknown,
        _signal: unknown,
        handlers: { onToken?: (delta: string) => void } | undefined,
      ) => {
        handlers?.onToken?.('Hello')
        return 'Hello'
      },
    )
    mockFetchCompletion.mockImplementationOnce(
      async (
        _settings: unknown,
        _request: unknown,
        _maxTokens: unknown,
        _signal: unknown,
        handlers: { onToken?: (delta: string) => void } | undefined,
      ) => {
        handlers?.onToken?.('partial')
        throw new NoSuchToolError({ toolName: 'getGraphOverview' })
      },
    )

    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })
    await sendMessage('Continue')

    expect(mockFetchCompletion).toHaveBeenCalledTimes(2)
  })

  it('does not retry ordinary tool execution failures', async () => {
    mockFetchCompletion.mockImplementationOnce(
      async (
        _settings: unknown,
        _request: unknown,
        _maxTokens: unknown,
        _signal: unknown,
        handlers: { onToken?: (delta: string) => void } | undefined,
      ) => {
        handlers?.onToken?.('Hello')
        return 'Hello'
      },
    )
    mockFetchCompletion.mockImplementationOnce(async () => {
      throw new Error('tool execution failed')
    })

    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })
    await sendMessage('Continue')

    expect(mockFetchCompletion).toHaveBeenCalledTimes(2)
  })

  it('does not probe again after a failed legacy retry', async () => {
    mockFetchCompletion.mockImplementationOnce(
      async (
        _settings: unknown,
        _request: unknown,
        _maxTokens: unknown,
        _signal: unknown,
        handlers: { onToken?: (delta: string) => void } | undefined,
      ) => {
        handlers?.onToken?.('Hello')
        return 'Hello'
      },
    )
    mockFetchCompletion.mockImplementationOnce(async () => {
      throw new NoSuchToolError({ toolName: 'getGraphOverview' })
    })
    mockFetchCompletion.mockImplementationOnce(async () => {
      throw new Error('legacy failed')
    })

    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })
    await sendMessage('Continue')

    expect(mockFetchCompletion).toHaveBeenCalledTimes(3)

    await sendMessage('Try a second turn')

    expect(mockFetchCompletion).toHaveBeenCalledTimes(4)
    expect(mockFetchCompletion.mock.calls[3][1]).not.toHaveProperty('tools')
  })

  it('uses the captured selection for a legacy retry', async () => {
    useGraphStore.setState({
      nodes: [concept('n-1', 'Original title', 'Original definition')],
      selected: { kind: 'node', id: 'n-1' },
    })
    mockBuildLegacyMentorPrompt.mockImplementation(
      (_nodes: unknown, _edges: unknown, selection: unknown) =>
        `Nodes: selection ${JSON.stringify(selection)}`,
    )
    mockFetchCompletion.mockImplementationOnce(async () => {
      useGraphStore.setState({ selected: null })
      throw new NoSuchToolError({ toolName: 'getGraphOverview' })
    })

    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })

    expect(mockFetchCompletion.mock.calls[1][1]).toMatchObject({
      instructions: 'Nodes: selection {"kind":"node","id":"n-1"}',
    })
  })

  it('does not retry an aborted compatibility failure', async () => {
    let rejectPrimary!: (error: unknown) => void
    let primarySignal: AbortSignal | undefined
    mockFetchCompletion.mockImplementationOnce(
      async (
        _settings: unknown,
        _request: unknown,
        _maxTokens: unknown,
        _signal: unknown,
        handlers: { onToken?: (delta: string) => void } | undefined,
      ) => {
        handlers?.onToken?.('Hello')
        return 'Hello'
      },
    )
    mockFetchCompletion.mockImplementationOnce(
      async (_settings: unknown, _request: unknown, _maxTokens: unknown, signal: AbortSignal) => {
        primarySignal = signal
        return new Promise<string>((_resolve, reject) => {
          rejectPrimary = reject
        })
      },
    )

    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })
    await sendMessage('Stop this')

    await act(async () => {
      useGraphStore.getState().setMentorPanelExpanded(false)
    })
    expect(primarySignal?.aborted).toBe(true)

    await act(async () => {
      rejectPrimary(new NoSuchToolError({ toolName: 'getGraphOverview' }))
    })
    expect(mockFetchCompletion).toHaveBeenCalledTimes(2)
  })

  it('resets tool capability when starting a new chat', async () => {
    await renderLegacyChat()

    const [newChatButton] = Array.from(container!.querySelectorAll('button'))
    await act(async () => {
      newChatButton!.click()
    })

    expect(mockFetchCompletion).toHaveBeenCalledTimes(3)
    expect(mockFetchCompletion.mock.calls[2][1]).toHaveProperty('tools')
  })

  it('resets tool capability when the panel is closed and reopened', async () => {
    await renderLegacyChat()

    await act(async () => {
      useGraphStore.getState().setMentorPanelExpanded(false)
    })
    await act(async () => {
      useGraphStore.getState().setMentorPanelExpanded(true)
    })

    expect(mockFetchCompletion).toHaveBeenCalledTimes(3)
    expect(mockFetchCompletion.mock.calls[2][1]).toHaveProperty('tools')
  })

  it('resets tool capability when the graph changes', async () => {
    await renderLegacyChat()

    await act(async () => {
      useGraphStore.setState({ currentGraphId: 'test-graph-2' })
    })

    expect(mockFetchCompletion).toHaveBeenCalledTimes(3)
    expect(mockFetchCompletion.mock.calls[2][1]).toHaveProperty('tools')
  })

  it('resets tool capability when the base URL changes', async () => {
    await renderLegacyChat()

    await act(async () => {
      const settings = useGraphStore.getState().settings
      useGraphStore.setState({
        settings: { ...settings, aiBaseUrl: 'http://localhost:11435/v1' },
      })
    })

    expect(mockFetchCompletion).toHaveBeenCalledTimes(3)
    expect(mockFetchCompletion.mock.calls[2][1]).toHaveProperty('tools')
  })

  it('resets tool capability when the model changes', async () => {
    await renderLegacyChat()

    await act(async () => {
      const settings = useGraphStore.getState().settings
      useGraphStore.setState({ settings: { ...settings, aiModel: 'other-model' } })
    })

    expect(mockFetchCompletion).toHaveBeenCalledTimes(3)
    expect(mockFetchCompletion.mock.calls[2][1]).toHaveProperty('tools')
  })

  it('keeps the legacy snapshot out of the normal tool-enabled request', async () => {
    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })

    expect(mockBuildLegacyMentorPrompt).not.toHaveBeenCalled()
    expect(mockFetchCompletion.mock.calls[0][1]).not.toHaveProperty(
      'instructions',
      'Nodes: legacy snapshot',
    )
  })

  it('sends compact opener instructions with exactly the six graph tools', async () => {
    useGraphStore.setState({
      nodes: [concept('n-1', 'Secret title', 'Secret definition')],
      selected: { kind: 'node', id: 'n-1' },
    })

    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })

    const request = mockFetchCompletion.mock.calls[0][1] as {
      instructions: string
      tools: Record<string, unknown>
    }
    expect(request.instructions).toContain('Graph counts: 1 concept; 0 relations.')
    expect(request.instructions).toContain('Selection: {"kind":"node","id":"n-1"}.')
    expect(request.instructions).not.toContain('Secret title')
    expect(request.instructions).not.toContain('Secret definition')
    expect(Object.keys(request.tools)).toEqual([
      'getGraphOverview',
      'searchConcepts',
      'inspectConcept',
      'inspectRelation',
      'listNeighbors',
      'getRelationTypes',
    ])
  })

  it('sends only visible text history after the opener', async () => {
    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })

    await sendMessage('What is knowledge?')

    const request = mockFetchCompletion.mock.calls[1][1] as {
      messages: { role: string; content: string }[]
    }
    expect(request.messages).toEqual([
      { role: 'assistant', content: 'Hello' },
      { role: 'user', content: 'What is knowledge?' },
    ])
    expect(
      request.messages.every(
        ({ role, content }) => ['user', 'assistant'].includes(role) && typeof content === 'string',
      ),
    ).toBe(true)
  })

  it('captures selection in the prompt while tools read the edited live graph', async () => {
    useGraphStore.setState({
      nodes: [concept('n-1', 'Original title', 'Original definition')],
      selected: { kind: 'node', id: 'n-1' },
    })

    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })

    const request = mockFetchCompletion.mock.calls[0][1] as {
      instructions: string
      tools: Record<
        string,
        {
          execute?: (input: { id: string }, options: never) => Promise<unknown>
        }
      >
    }
    useGraphStore.setState({
      nodes: [concept('n-1', 'Edited title', 'Edited definition')],
      selected: null,
    })

    const result = await request.tools.inspectConcept.execute!({ id: 'n-1' }, {} as never)
    expect(result).toMatchObject({ found: true, id: 'n-1', title: 'Edited title' })
    expect(request.instructions).toContain('Selection: {"kind":"node","id":"n-1"}.')
  })

  it('aborts an active send when the panel closes', async () => {
    let sendSignal: AbortSignal | undefined
    let resolveSend!: (value: string) => void
    mockFetchCompletion.mockImplementationOnce(
      async (
        _settings: unknown,
        _request: unknown,
        _maxTokens: unknown,
        _signal: AbortSignal,
        handlers: { onToken?: (delta: string) => void },
      ) => {
        handlers.onToken?.('Hello')
        return 'Hello'
      },
    )
    mockFetchCompletion.mockImplementationOnce(
      async (_settings: unknown, _request: unknown, _maxTokens: unknown, signal: AbortSignal) => {
        sendSignal = signal
        return new Promise<string>((resolve) => {
          resolveSend = resolve
        })
      },
    )

    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })
    await sendMessage('Stop this request')

    await act(async () => {
      useGraphStore.getState().setMentorPanelExpanded(false)
    })

    expect(mockFetchCompletion).toHaveBeenCalledTimes(2)
    expect(sendSignal).toBeDefined()
    expect(sendSignal?.aborted).toBe(true)
    await act(async () => {
      resolveSend('late reply')
    })

    await act(async () => {
      useGraphStore.getState().setMentorPanelExpanded(true)
    })
    const [newChatButton] = Array.from(container!.querySelectorAll('button'))
    expect(newChatButton?.disabled).toBe(false)
  })

  it('does not let an older request clear a newer request thinking state', async () => {
    let firstHandlers: { onToken?: (delta: string) => void } | undefined
    let resolveFirst!: (value: string) => void
    let resolveSecond!: (value: string) => void
    mockFetchCompletion.mockImplementationOnce(
      async (
        _settings: unknown,
        _request: unknown,
        _maxTokens: unknown,
        _signal: AbortSignal,
        handlers: { onToken?: (delta: string) => void },
      ) => {
        handlers.onToken?.('Hello')
        return 'Hello'
      },
    )
    mockFetchCompletion.mockImplementationOnce(
      async (
        _settings: unknown,
        _request: unknown,
        _maxTokens: unknown,
        _signal: AbortSignal,
        handlers: { onToken?: (delta: string) => void },
      ) => {
        firstHandlers = handlers
        return new Promise<string>((resolve) => {
          resolveFirst = resolve
        })
      },
    )
    mockFetchCompletion.mockImplementationOnce(
      async () =>
        new Promise<string>((resolve) => {
          resolveSecond = resolve
        }),
    )

    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })
    await sendMessage('First request')

    expect(mockFetchCompletion).toHaveBeenCalledTimes(2)
    expect(firstHandlers).toBeDefined()
    await act(async () => {
      firstHandlers?.onToken?.('partial')
    })
    await sendMessage('Second request')
    expect(mockFetchCompletion).toHaveBeenCalledTimes(3)

    await act(async () => {
      resolveFirst('late first reply')
    })

    const [newChatButton] = Array.from(container!.querySelectorAll('button'))
    expect(newChatButton?.disabled).toBe(false)

    await act(async () => {
      resolveSecond('second reply')
    })
  })
})
