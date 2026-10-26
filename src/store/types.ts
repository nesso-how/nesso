import type { NessoOperation, NessoState, NessoStore, Preferences, SectionId } from '@nesso-how/plugin'
import type { AiChatMessage } from '@nesso-how/ai'
import type { PersistenceIssue } from '../../shared/persistence.ts'

export const sectionIds = [
  'sidebar', 'sidebar.pinned-views', 'sidebar.views',
  'inspector', 'inspector.connections', 'inspector.views', 'inspector.nodes',
] as const satisfies readonly SectionId[]

export type HostState = NessoState & {
  readonly documentEpoch: number
  readonly conversation: { readonly messages: readonly AiChatMessage[] }
  readonly persistenceIssues: readonly Readonly<PersistenceIssue>[]
}

export type HostOperation = NessoOperation
  | { readonly kind: 'preferences.intro-seen' }
  | { readonly kind: 'preferences.inspectorTab'; readonly value: NonNullable<Preferences['inspectorTab']> }
  | { readonly kind: 'conversation.messages'; readonly value: readonly AiChatMessage[] }
  | { readonly kind: 'conversation.clear' }

export type HostStore = Omit<NessoStore, 'getState' | 'applyOperations'> & {
  readonly getState: () => HostState
  readonly applyOperations: (operations: readonly HostOperation[], options?: Parameters<NessoStore['applyOperations']>[1]) => void
  readonly setChatMessages: (messages: readonly AiChatMessage[]) => void
  readonly clearChat: () => void
}

export type RestoredState = Partial<Pick<HostState, 'workspace' | 'preferences' | 'conversation'>>

export type RendererDefinition = { readonly id: string }
