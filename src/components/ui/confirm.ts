// SPDX-License-Identifier: MIT
import { useGraphStore } from '@/store'
import type { ConfirmRequest } from '@/store/types'

let pending: ((confirmed: boolean) => void) | null = null

/**
 * Imperative replacement for `window.confirm`. Opens the `<ConfirmDialog>`
 * mounted at the app shell and resolves to the user's choice. A new request
 * supersedes any still-open one (the previous resolves to `false`).
 */
export function confirm(request: ConfirmRequest): Promise<boolean> {
  pending?.(false)
  return new Promise<boolean>((resolve) => {
    pending = resolve
    useGraphStore.getState().openConfirm(request)
  })
}

export function settleConfirm(confirmed: boolean): void {
  const resolve = pending
  pending = null
  useGraphStore.getState().closeConfirm()
  resolve?.(confirmed)
}
