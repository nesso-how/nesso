// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { ZUSTAND_PERSIST_KEY } from '@/data/storageKeys'
import { useGraphStore } from '../index'
import { createUISlice, type UISlice } from './ui'

describe('review reminder UI state', () => {
  it('records local days immutably and independently by graph', () => {
    const store = createStore<UISlice>()((set, get, api) =>
      createUISlice(set as never, get as never, api as never),
    )
    const initial = store.getState().reviewReminderLastShownByGraph

    store.getState().markReviewReminderShown('graph-a', '2026-07-22')
    store.getState().markReviewReminderShown('graph-b', '2026-07-21')

    expect(store.getState().reviewReminderLastShownByGraph).toEqual({
      'graph-a': '2026-07-22',
      'graph-b': '2026-07-21',
    })
    expect(store.getState().reviewReminderLastShownByGraph).not.toBe(initial)
  })
})

describe('writing mode ui state', () => {
  it('opens and closes transiently', () => {
    const store = createStore<UISlice>()((set, get, api) =>
      createUISlice(set as never, get as never, api as never),
    )
    expect(store.getState().writingModeNodeId).toBeNull()
    store.getState().openWritingMode('n1')
    expect(store.getState().writingModeNodeId).toBe('n1')
    store.getState().closeWritingMode()
    expect(store.getState().writingModeNodeId).toBeNull()
  })

  it('is never written to the persisted store blob', () => {
    useGraphStore.getState().openWritingMode('n1')
    const raw = window.localStorage.getItem(ZUSTAND_PERSIST_KEY)
    expect(raw).not.toBeNull()
    const persisted = JSON.parse(raw!) as {
      version: number
      state: Record<string, unknown>
    }
    // Zustand persist wraps the partialized state: { version, state }.
    expect(typeof persisted.version).toBe('number')
    // Non-vacuous guard: a known persisted field must be present in `state`,
    // proving the subtree below is the real serialized state.
    expect(persisted.state).toHaveProperty('reviewReminderLastShownByGraph')
    expect(persisted.state).not.toHaveProperty('writingModeNodeId')
    useGraphStore.getState().closeWritingMode()
    window.localStorage.removeItem(ZUSTAND_PERSIST_KEY)
  })
})
