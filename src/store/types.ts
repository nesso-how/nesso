import type { NessoState, NessoStore, Preferences, WorkspaceState } from '@nesso/plugin'
import type { SchemaIssue } from '@nesso/schema'

export type PanelSizes = {
  readonly explorerWidth: number
  readonly inspectorWidth: number
}

export type HostWorkspace = WorkspaceState

export const sectionIds = [
  'sidebar', 'sidebar.pinned-views', 'sidebar.views',
  'inspector.connections', 'inspector.views', 'inspector.nodes',
] as const

export type SectionId = typeof sectionIds[number]

export type HostPreferences = Preferences & {
  readonly activeThemeId: string
  readonly panels: PanelSizes
  readonly collapsedSections?: readonly SectionId[]
}

export type HostState = NessoState & {
  readonly workspace: HostWorkspace
  readonly preferences: HostPreferences
  readonly persistenceIssues: readonly Readonly<SchemaIssue>[]
}

export type HostStore = Omit<NessoStore, 'getState'> & {
  readonly getState: () => HostState
}

export type RestoredState = Partial<Pick<HostState, 'workspace' | 'preferences'>>
