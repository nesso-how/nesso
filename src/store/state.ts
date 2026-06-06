// SPDX-License-Identifier: MIT
import type { DesktopSyncSlice } from './slices/desktop-sync'
import type { GraphEditingSlice } from './slices/graph-editing'
import type { GraphManagementSlice } from './slices/graph-management'
import type { SettingsSlice } from './slices/settings'
import type { UISlice } from './slices/ui'

export type GraphState = GraphEditingSlice &
  SettingsSlice &
  UISlice &
  GraphManagementSlice &
  DesktopSyncSlice
