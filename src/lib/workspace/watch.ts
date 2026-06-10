// SPDX-License-Identifier: MIT

// Counter (not boolean) so nested suppress pairs are safe — e.g. a rename
// inside a write inside a reconcile won't prematurely re-enable the watcher.
let suppressWatchCount = 0

// The fs watcher delivers events after the write promise resolves, so the
// counter alone misses our own writes and every autosave used to trigger a
// full-workspace reconcile. Writers register the exact paths they touch;
// events whose paths are all recent self-writes are dropped as echoes.
// Entries expire so a later external edit to the same file is still seen.
const SELF_WRITE_TTL_MS = 2500
const recentSelfWrites = new Map<string, number>()

function normalizeEventPath(p: string): string {
  return p.replace(/\\/g, '/')
}

export function noteSelfWrite(...paths: string[]): void {
  const expiry = Date.now() + SELF_WRITE_TTL_MS
  for (const p of paths) recentSelfWrites.set(normalizeEventPath(p), expiry)
}

/** True when every changed path is a not-yet-expired write of our own. */
export function isSelfWriteEcho(paths: string[]): boolean {
  if (paths.length === 0) return false
  const now = Date.now()
  for (const [p, expiry] of recentSelfWrites) {
    if (expiry <= now) recentSelfWrites.delete(p)
  }
  return paths.every((p) => recentSelfWrites.has(normalizeEventPath(p)))
}

export function beginSuppressWatch(): void {
  suppressWatchCount++
}

export function endSuppressWatch(): void {
  suppressWatchCount = Math.max(0, suppressWatchCount - 1)
}

export function isWatchSuppressed(): boolean {
  return suppressWatchCount > 0
}
