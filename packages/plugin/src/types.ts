import type { Graph, Position, RelationType } from '@nesso/schema'
import type { ComponentType } from 'react'

type DeepReadonly<T> = T extends readonly (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T

export type Selection =
  | { readonly kind: 'concept'; readonly id: string }
  | { readonly kind: 'relation'; readonly id: string }
  | null

export type GraphSnapshot = DeepReadonly<Graph>

export type VocabDefinition = {
  readonly id: string
  readonly label: string
  readonly relationTypes: readonly Readonly<RelationType>[]
  readonly defaultTypeId: string
}

export type ViewMode = 'focus' | 'whole'

export type NessoState = {
  readonly graph: GraphSnapshot
  readonly view: ViewMode
  readonly viewGraph: GraphSnapshot
  readonly focusId: string
  readonly selected: Selection
  readonly vocabs: readonly VocabDefinition[]
  readonly activeVocabId: string
  readonly activeRendererId: string
}

export type NessoStore = {
  readonly getState: () => NessoState
  readonly subscribe: (listener: () => void) => () => void
  readonly setFocus: (id: string) => void
  readonly setSelection: (selection: Selection) => void
  readonly setView: (mode: ViewMode) => void
  readonly setConceptPosition: (id: string, position: Readonly<Position>) => void
  readonly setConceptPositions: (updates: readonly { readonly id: string; readonly position: Readonly<Position> }[]) => void
  readonly setConceptLabel: (id: string, label: string) => void
  readonly addTags: (id: string, tags: readonly string[]) => void
  readonly removeTag: (id: string, tag: string) => void
  readonly addConcept: (position?: Readonly<Position>) => string
  readonly connect: (source: string, target: string) => void
  readonly setRelationType: (id: string, typeId: string) => void
  readonly createRelationType: (id: string, label: string) => void
  readonly removeConcept: (id: string) => void
  readonly removeRelation: (id: string) => void
  readonly editGraph: (edit: (graph: Graph) => Graph) => void
  readonly setActiveVocab: (id: string) => void
  readonly setActiveRenderer: (id: string) => void
}

export type RendererDefinition = {
  readonly id: string
  readonly label: string
  readonly component: ComponentType
}

export type ActionDefinition = {
  readonly id: string
  readonly label: string
  readonly run: () => void
}

export type PluginDefinition = {
  readonly renderers?: readonly RendererDefinition[]
  readonly vocabs?: readonly VocabDefinition[]
  readonly actions?: readonly ActionDefinition[]
}

export type PluginContext = { readonly store: NessoStore }

export type Plugin = (context: PluginContext) => PluginDefinition
