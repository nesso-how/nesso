export interface ConceptNodeData extends Record<string, unknown> {
  text: string
  conf: number        // 1–5
  reviewed: number    // days ago
  pinned: boolean
}

export type EdgeCategory =
  | 'taxonomic'
  | 'structural'
  | 'causal'
  | 'dependency'
  | 'temporal'
  | 'opposition'

export type EdgeTypeName =
  | 'is-a' | 'instance-of' | 'subtype-of'
  | 'part-of' | 'made-of' | 'contains'
  | 'causes' | 'produces' | 'enables' | 'prevents' | 'triggers'
  | 'requires' | 'uses'
  | 'precedes' | 'occurs-in'
  | 'contrasts-with' | 'opposite-of'

export interface EdgeTypeDef {
  cat: EdgeCategory
  line: 'solid' | 'dashed' | 'dotted' | 'double' | 'wavy'
  glyph: GlyphKind
  symmetric: boolean
  label: string
}

export type GlyphKind =
  | 'triangle-up' | 'circle-dot' | 'diamond' | 'diamond-open' | 'hash'
  | 'arrow-right' | 'asterisk' | 'key' | 'block' | 'spark'
  | 'anchor' | 'tool' | 'chevron-r' | 'ring' | 'tilde' | 'x'

export type EdgeEncoding = 'full' | 'category' | 'minimal'
export type CurveStyle = 'arc' | 'straight'
export type CategoryPalette = 'default' | 'vivid' | 'muted' | 'monoCat'

export interface NessoSettings {
  dark: boolean
  accent: string
  edgeEncoding: EdgeEncoding
  showLabels: boolean
  showConfidence: boolean
  curveStyle: CurveStyle
  categoryPalette: CategoryPalette
}
