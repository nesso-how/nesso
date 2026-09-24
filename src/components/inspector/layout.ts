// SPDX-License-Identifier: MIT
import { INSPECTOR_WIDTH_STORAGE_KEY } from '@/data/storageKeys'
import { createPanelWidthStorage } from '@/lib/panelWidth'

export const INSPECTOR_PANEL_EDGE_INSET = 12
export const INSPECTOR_CANVAS_LEFT_GUTTER = INSPECTOR_PANEL_EDGE_INSET * 2
export const INSPECTOR_PANEL_MIN_WIDTH = 220
export const INSPECTOR_PANEL_MAX_WIDTH = 720
export const INSPECTOR_PANEL_DEFAULT_WIDTH = 340

const inspectorPanelWidthStorage = createPanelWidthStorage({
  storageKey: INSPECTOR_WIDTH_STORAGE_KEY,
  min: INSPECTOR_PANEL_MIN_WIDTH,
  max: INSPECTOR_PANEL_MAX_WIDTH,
  fallback: INSPECTOR_PANEL_DEFAULT_WIDTH,
})

export const clampInspectorPanelWidth = inspectorPanelWidthStorage.clampWidth
export const readInspectorPanelWidth = inspectorPanelWidthStorage.readWidth
export const writeInspectorPanelWidth = inspectorPanelWidthStorage.writeWidth
