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

export type NessoOperation =
  | { readonly kind: 'concept.label'; readonly id: string; readonly value: string }
  | { readonly kind: 'concept.position'; readonly id: string; readonly value: Readonly<Position> }
  | { readonly kind: 'concept.positions'; readonly updates: readonly { readonly id: string; readonly position: Readonly<Position> }[] }
  | { readonly kind: 'concept.add'; readonly id: string; readonly position?: Readonly<Position> }
  | { readonly kind: 'concept.remove'; readonly id: string }
  | { readonly kind: 'relation.connect'; readonly source: string; readonly target: string }
  | { readonly kind: 'relation.reconnect'; readonly id: string; readonly source: string; readonly target: string }
  | { readonly kind: 'relation.type'; readonly id: string; readonly typeId: string }
  | { readonly kind: 'relation.type.create'; readonly id: string; readonly typeId: string; readonly label: string }
  | { readonly kind: 'relation.remove'; readonly id: string }
  | { readonly kind: 'document.reset'; readonly id: string }
  | { readonly kind: 'selection.set'; readonly value: Selection }
  | { readonly kind: 'view.activate'; readonly id: string | null }
  | { readonly kind: 'view.create'; readonly id: string; readonly name: string; readonly conceptIds: readonly string[] }
  | { readonly kind: 'view.rename'; readonly id: string; readonly name: string }
  | { readonly kind: 'view.pin'; readonly id: string; readonly pinned: boolean }
  | { readonly kind: 'view.membership'; readonly viewId: string; readonly conceptId: string; readonly included: boolean }
  | { readonly kind: 'view.remove'; readonly id: string }
  | { readonly kind: 'viewport.set'; readonly rendererId: string; readonly value: Viewport }
  | { readonly kind: 'preferences.vocab'; readonly id: string }
  | { readonly kind: 'preferences.renderer'; readonly id: string }
  | { readonly kind: 'preferences.theme'; readonly id: string }
  | { readonly kind: 'preferences.panels'; readonly value: PanelSizes }
  | { readonly kind: 'preferences.section'; readonly id: SectionId; readonly open: boolean }

export type VocabDefinition = {
  readonly id: string
  readonly label: string
  readonly relationTypes: readonly Readonly<RelationType>[]
  readonly defaultTypeId: string
}

export type SavedView = {
  readonly id: string
  readonly name: string
  readonly conceptIds: readonly string[]
  readonly pinned: boolean
}

export type Viewport = {
  readonly x: number
  readonly y: number
  readonly zoom: number
}

export type WorkspaceState = {
  readonly activeViewId: string | null
  readonly savedViews: readonly SavedView[]
  readonly viewports: Readonly<Partial<Record<string, Viewport>>>
}

export type PanelSizes = {
  readonly explorerWidth: number
  readonly inspectorWidth: number
}

export type SectionId =
  | 'sidebar' | 'sidebar.pinned-views' | 'sidebar.views'
  | 'inspector.connections' | 'inspector.views' | 'inspector.nodes'

export type Preferences = {
  readonly activeVocabId: string
  readonly activeRendererId: string
  readonly activeThemeId: string
  readonly panels: PanelSizes
  readonly collapsedSections?: readonly SectionId[]
}

export type NessoState = {
  readonly graph: GraphSnapshot
  readonly workspace: WorkspaceState
  readonly preferences: Preferences
  readonly viewGraph: GraphSnapshot
  readonly selected: Selection
  readonly vocabs: readonly VocabDefinition[]
}

export type NessoStore = {
  readonly getState: () => NessoState
  readonly subscribe: (listener: () => void) => () => void
  readonly conceptPlacementOffset: Readonly<Position>
  readonly setSelection: (selection: Selection) => void
  readonly setView: (id: string | null) => void
  readonly setViewport: (rendererId: string, viewport: Viewport) => void
  readonly setConceptPosition: (id: string, position: Readonly<Position>) => void
  readonly setConceptPositions: (updates: readonly { readonly id: string; readonly position: Readonly<Position> }[]) => void
  readonly setConceptLabel: (id: string, label: string) => void
  readonly addConcept: (position?: Readonly<Position>) => string
  readonly connect: (source: string, target: string) => void
  readonly reconnectRelation: (id: string, source: string, target: string) => void
  readonly setRelationType: (id: string, typeId: string) => void
  readonly createRelationType: (id: string, label: string) => void
  readonly removeConcept: (id: string) => void
  readonly removeRelation: (id: string) => void
  readonly applyOperations: (operations: readonly NessoOperation[]) => void
  readonly setActiveVocab: (id: string) => void
  readonly setActiveRenderer: (id: string) => void
  readonly setActiveTheme: (id: string) => void
  readonly setPanelSizes: (sizes: PanelSizes) => void
  readonly setSectionOpen: (id: SectionId, open: boolean) => void
  readonly resetGraph: () => void
  readonly createView: (name: string, conceptIds: readonly string[]) => string
  readonly renameView: (id: string, name: string) => void
  readonly setViewPinned: (id: string, pinned: boolean) => void
  readonly setViewMembership: (viewId: string, conceptId: string, included: boolean) => void
  readonly deleteView: (id: string) => void
  readonly getViewGraph: (id: string) => GraphSnapshot
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

export type ThemeDefinition = {
  readonly id: string
  readonly label: string
}

export type PluginDefinition = {
  readonly renderers?: readonly RendererDefinition[]
  readonly vocabs?: readonly VocabDefinition[]
  readonly actions?: readonly ActionDefinition[]
  readonly themes?: readonly ThemeDefinition[]
}

export type PluginContext = { readonly store: NessoStore }

export type Plugin = {
  readonly operations: readonly NessoOperation['kind'][]
  readonly create: (context: PluginContext) => PluginDefinition
}
