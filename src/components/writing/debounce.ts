// SPDX-License-Identifier: MIT
export interface TrailingDebounce<T> {
  (value: T): void
  cancel: () => void
}

/** Trailing-edge debounce with explicit cancel (stale/deletion lifecycle). */
export function createTrailingDebounce<T>(
  fn: (value: T) => void,
  delayMs: number,
): TrailingDebounce<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: T | undefined
  const schedule = ((value: T) => {
    pending = value
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      if (pending !== undefined) fn(pending)
      pending = undefined
    }, delayMs)
  }) as TrailingDebounce<T>
  schedule.cancel = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    pending = undefined
  }
  return schedule
}
