import type { NessoState, NessoStore, SectionId } from '@nesso/plugin'
import type { SchemaIssue } from '@nesso/schema'

export const sectionIds = [
  'sidebar', 'sidebar.pinned-views', 'sidebar.views',
  'inspector.connections', 'inspector.views', 'inspector.nodes',
] as const satisfies readonly SectionId[]

export type HostState = NessoState & {
  readonly persistenceIssues: readonly Readonly<SchemaIssue>[]
}

export type HostStore = Omit<NessoStore, 'getState'> & {
  readonly getState: () => HostState
}

export type RestoredState = Partial<Pick<HostState, 'workspace' | 'preferences'>>
