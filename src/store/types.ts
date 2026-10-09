import type { NessoOperation, NessoState, NessoStore, SectionId } from '@nesso/plugin'
import type { AiChatMessage } from '@nesso/ai'
import type { SchemaIssue } from '@nesso/schema'

export const sectionIds = [
  'sidebar', 'sidebar.pinned-views', 'sidebar.views',
  'inspector.connections', 'inspector.views', 'inspector.nodes',
] as const satisfies readonly SectionId[]

export type HostState = NessoState & {
  readonly conversation: { readonly messages: readonly AiChatMessage[] }
  readonly persistenceIssues: readonly Readonly<SchemaIssue>[]
}

export type HostOperation = NessoOperation
  | { readonly kind: 'conversation.messages'; readonly value: readonly AiChatMessage[] }
  | { readonly kind: 'conversation.clear' }

export type HostStore = Omit<NessoStore, 'getState' | 'applyOperations'> & {
  readonly getState: () => HostState
  readonly applyOperations: (operations: readonly HostOperation[], options?: Parameters<NessoStore['applyOperations']>[1]) => void
  readonly setChatMessages: (messages: readonly AiChatMessage[]) => void
  readonly clearChat: () => void
}

export type RestoredState = Partial<Pick<HostState, 'workspace' | 'preferences' | 'conversation'>>
