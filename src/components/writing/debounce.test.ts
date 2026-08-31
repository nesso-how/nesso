// SPDX-License-Identifier: MIT
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTrailingDebounce } from './debounce'

describe('createTrailingDebounce', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('fires once after the trailing delay with the latest value', () => {
    const seen: number[] = []
    const schedule = createTrailingDebounce((v: number) => seen.push(v), 800)
    schedule(1)
    schedule(2)
    vi.advanceTimersByTime(799)
    expect(seen).toEqual([])
    vi.advanceTimersByTime(1)
    expect(seen).toEqual([2])
  })

  it('cancel() drops the pending call', () => {
    const seen: number[] = []
    const schedule = createTrailingDebounce((v: number) => seen.push(v), 800)
    schedule(1)
    schedule.cancel()
    vi.advanceTimersByTime(2_000)
    expect(seen).toEqual([])
  })
})
