// SPDX-License-Identifier: MIT

/** True when the Tauri runtime is present (any platform, including mobile). */
function hasTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** True when running on a Tauri mobile platform (Android / iOS). */
function isMobileTauri(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
}

/**
 * True when running inside the Tauri desktop shell (not mobile Tauri or plain web).
 *
 * Mobile Tauri (Android / iOS) also sets __TAURI_INTERNALS__, but desktop
 * trust seeding, the native menu bar, fs plugin workspace layer, and native
 * save/open dialogs are desktop-only.  Reject mobile platforms so the app
 * falls back to indexedDB/web behaviour instead of crashing on unsupported
 * native features.
 */
export function isDesktop(): boolean {
  return hasTauriRuntime() && !isMobileTauri()
}
