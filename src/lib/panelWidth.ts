// SPDX-License-Identifier: MIT

/** Shared persisted-width storage for resizable side panels (sidebar, inspector).
 *  Panel widths live in `localStorage` — deliberately outside the graph store —
 *  and every panel clamps with the same shape:
 *  `Math.min(max, Math.max(min, Math.round(w)))`. */

export interface PanelWidthStorageConfig {
  storageKey: string
  min: number
  max: number
  fallback: number
}

export interface PanelWidthStorage {
  clampWidth: (w: number) => number
  readWidth: () => number
  writeWidth: (w: number) => void
}

export function createPanelWidthStorage({
  storageKey,
  min,
  max,
  fallback,
}: PanelWidthStorageConfig): PanelWidthStorage {
  function clampWidth(w: number): number {
    return Math.min(max, Math.max(min, Math.round(w)))
  }

  function readWidth(): number {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw == null) return fallback
      return clampWidth(Number(raw))
    } catch {
      return fallback
    }
  }

  function writeWidth(w: number): void {
    try {
      localStorage.setItem(storageKey, String(clampWidth(w)))
    } catch {
      /* ignore quota / privacy mode */
    }
  }

  return { clampWidth, readWidth, writeWidth }
}
