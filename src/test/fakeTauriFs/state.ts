// SPDX-License-Identifier: MIT

const files = new Map<string, string>()
const dirs = new Set<string>()
let dialogResult: string | null = null
let saveFileDialogError: string | null = null
let saveFileDialogErrorIsString: boolean = false

/** Tracks paths granted via `grant_fs_scope` during tests. */
const grantedPaths = new Set<string>()

/**
 * Persistent trust store mirroring the real Rust `.nesso-trusted-paths.json`.
 * Paths approved via the native picker (or seeded by tests) land here;
 * only paths under a trusted root or under an app-data `.nesso` subtree
 * pass `grantFsScopeAccept`.
 */
const trustedPaths = new Set<string>()

/**
 * Minimal structural path validation for the test fake's `grant_fs_scope`
 * handler.  Mirrors the real Rust `is_path_safe_for_grant` checks that
 * don't require trust-store context: absolute, no traversal, not root,
 * no hidden components except `.nesso`.
 */
function isPathSafeForGrantFake(path: string): boolean {
  if (!path || !path.startsWith('/')) return false
  if (path.includes('..')) return false
  // Filesystem root.
  if (path === '/') return false
  // Hidden components except `.nesso`.
  const segments = path.split('/').filter(Boolean)
  if (segments.some((s) => s.startsWith('.') && s !== '.nesso')) return false
  return true
}

/**
 * Test-only hook: seed a path into the fake trust store so subsequent
 * `grant_fs_scope` calls for that path (or its descendants) are accepted
 * without requiring a native-picker round-trip.  Mirrors the real Rust
 * startup seeding of the default workspace.
 */
export function seedTrustedPath(path: string): void {
  trustedPaths.add(path.replace(/\/+$/, ''))
}

/**
 * Returns the current set of trusted (picker-approved) paths for test
 * assertions.
 */
export function getTrustedPaths(): ReadonlySet<string> {
  return trustedPaths
}

/**
 * Checks whether a path is authorized for fs scope grant.
 *
 * A path is trusted when:
 * 1. It lives under an app-data directory AND contains `.nesso` as a
 *    component (auto-grant for app-internal data), OR
 * 2. It (or an ancestor) was previously approved via the native picker
 *    (exists in the trust store).
 */
function isPathTrustedFake(path: string): boolean {
  const norm = path.replace(/\/+$/, '')

  // App-data auto-grant: paths under /appdata containing .nesso.
  if (norm.startsWith('/appdata/') && norm.split('/').some((s) => s === '.nesso')) {
    return true
  }

  // Trust store check: exact match or descendant of a trusted root.
  if (trustedPaths.has(norm)) return true
  for (const tp of trustedPaths) {
    if (norm === tp || norm.startsWith(tp + '/')) return true
  }

  return false
}

export function grantFsScopeAccept(path: string): void {
  if (!path) return
  if (!isPathSafeForGrantFake(path)) return
  // The real Rust rejects app-data root even if in trust store.
  const norm = path.replace(/\/+$/, '')
  if (norm === '/appdata') return
  if (!isPathTrustedFake(path)) return
  grantedPaths.add(path)
}

export function getGrantedPaths(): ReadonlySet<string> {
  return grantedPaths
}

export const tauriFsState = {
  files,
  dirs,
  reset(): void {
    files.clear()
    dirs.clear()
    dialogResult = null
    saveFileDialogError = null
    saveFileDialogErrorIsString = false
    grantedPaths.clear()
    trustedPaths.clear()
  },
  writeFile(path: string, content: string): void {
    files.set(path, content)
  },
  /** What the next dialog `save`/`open` returns (the picked folder path, or null). */
  setDialogResult(path: string | null): void {
    dialogResult = path
  },
  /**
   * When non-null, the next `save_file_dialog` invoke throws this error
   * (simulating the non-desktop Tauri platform where the command is
   * unsupported).  Takes priority over `setDialogResult`.
   *
   * By default the error is thrown as `new Error(message)`.  Set
   * `setSaveFileDialogErrorAsString(true)` before calling this to throw the
   * raw message string instead — matching the real Tauri invoke() behaviour
   * on mobile, which can reject with strings rather than Error objects.
   */
  setSaveFileDialogError(message: string | null): void {
    saveFileDialogError = message
  },
  /**
   * When `true`, the next `save_file_dialog` error is thrown as a raw
   * string instead of `new Error(message)`.  Resets to `false` in `reset()`.
   */
  setSaveFileDialogErrorAsString(value: boolean): void {
    saveFileDialogErrorIsString = value
  },
}

// Re-export internal state for use by sibling modules in this directory.
export function _getDialogResult(): string | null {
  return dialogResult
}
export function _getSaveFileDialogError(): string | null {
  return saveFileDialogError
}
export function _getSaveFileDialogErrorIsString(): boolean {
  return saveFileDialogErrorIsString
}
