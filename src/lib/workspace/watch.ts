// SPDX-License-Identifier: MIT

// Counter (not boolean) so nested suppress pairs are safe — e.g. a rename
// inside a write inside a reconcile won't prematurely re-enable the watcher.
let suppressWatchCount = 0

export function beginSuppressWatch(): void {
  suppressWatchCount++
}

export function endSuppressWatch(): void {
  suppressWatchCount = Math.max(0, suppressWatchCount - 1)
}

export function isWatchSuppressed(): boolean {
  return suppressWatchCount > 0
}
