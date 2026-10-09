type Counts = { readonly added: number; readonly updated: number; readonly removed: number }
type Page<T> = { readonly items: readonly T[]; readonly total: number; readonly nextOffset: number | null }
type View = { readonly id: string | null; readonly name: string }

export type AiEffects = {
  readonly concepts: Counts
  readonly relations: Counts
  readonly relationTypes: Counts
  readonly views: Counts
  readonly memberships: number
  readonly requiresApproval: boolean
}

export type AiToolResults = {
  readonly context: {
    readonly activeView: View
    readonly counts: { readonly concepts: number; readonly relations: number; readonly views: number }
    readonly visible: { readonly concepts: number; readonly relations: number }
    readonly selection: readonly { readonly kind: 'concept' | 'relation'; readonly id: string }[]
    readonly selectionCount: number
    readonly history: { readonly canUndo: boolean; readonly canRedo: boolean }
    readonly vocabulary: { readonly id: string; readonly label: string; readonly defaultTypeId: string } | null
  }
  readonly concepts: Page<{
    readonly id: string
    readonly label: string
    readonly position: { readonly x: number; readonly y: number }
  }>
  readonly relations: Page<{
    readonly id: string
    readonly source: string
    readonly predicate: string
    readonly target: string
  }>
  readonly views: Page<View & { readonly concepts: number; readonly pinned: boolean }>
    | (View & { readonly members: Page<string> })
  readonly relation_types: Page<{ readonly id: string; readonly label: string }>
  readonly selection: Page<{ readonly kind: 'concept' | 'relation'; readonly id: string }>
  readonly edit: AiEffects
  readonly history: { readonly action: 'undo' | 'redo'; readonly available: boolean }
}
