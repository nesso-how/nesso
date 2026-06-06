// SPDX-License-Identifier: MIT
import { INSPECTOR_WIDTH_STORAGE_KEY } from '@/data/storageKeys'

export const INSPECTOR_PANEL_EDGE_INSET = 12
export const INSPECTOR_CANVAS_LEFT_GUTTER = INSPECTOR_PANEL_EDGE_INSET * 2
export const INSPECTOR_PANEL_MIN_WIDTH = 220
export const INSPECTOR_PANEL_MAX_WIDTH = 520
export const INSPECTOR_PANEL_DEFAULT_WIDTH = 296
export const INSPECTOR_VIEWPORT_BOTTOM_RESERVE = 80

export function clampInspectorPanelWidth(w: number): number {
  return Math.min(INSPECTOR_PANEL_MAX_WIDTH, Math.max(INSPECTOR_PANEL_MIN_WIDTH, Math.round(w)))
}

export function readInspectorPanelWidth(): number {
  try {
    const raw = localStorage.getItem(INSPECTOR_WIDTH_STORAGE_KEY)
    if (raw == null) return INSPECTOR_PANEL_DEFAULT_WIDTH
    return clampInspectorPanelWidth(Number(raw))
  } catch {
    return INSPECTOR_PANEL_DEFAULT_WIDTH
  }
}

export function writeInspectorPanelWidth(w: number): void {
  try {
    localStorage.setItem(INSPECTOR_WIDTH_STORAGE_KEY, String(clampInspectorPanelWidth(w)))
  } catch {
    /* ignore quota / privacy mode */
  }
}
