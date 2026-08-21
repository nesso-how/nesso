// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'

// Suppress act() warnings in React 18 jsdom tests without @testing-library/react.
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
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
  it('does not construct the legacy snapshot prompt', async () => {
    await act(async () => {
      root!.render(<MentorPanel leftInset={0} rightInset={0} />)
    })

    expect(mockBuildLegacyMentorPrompt).not.toHaveBeenCalled()
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
    expect(newChatButton?.disabled).toBe(true)

    await act(async () => {
      resolveSecond('second reply')
    })
  })
})
