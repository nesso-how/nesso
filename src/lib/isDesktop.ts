// SPDX-License-Identifier: MIT

/** True when running inside the Tauri desktop shell (not the Vite web app). */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
