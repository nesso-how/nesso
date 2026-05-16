// SPDX-License-Identifier: MIT

export type EdgeCategory =
  | 'taxonomic'
  | 'structural'
  | 'causal'
  | 'dependency'
  | 'temporal'
  | 'opposition'
  | 'similarity'

export type EdgeTypeName =
  | 'is-a' | 'instance-of' | 'subtype-of'
  | 'part-of' | 'made-of' | 'contains'
  | 'causes' | 'produces' | 'enables' | 'prevents' | 'triggers' | 'inhibits'
  | 'requires' | 'uses' | 'used-for'
  | 'precedes' | 'occurs-in'
  | 'contrasts-with' | 'opposite-of'
  | 'similar-to' | 'analogous-to'

export type GlyphKind =
  | 'triangle-up' | 'circle-dot' | 'diamond' | 'diamond-open' | 'hash'
  | 'arrow-right' | 'asterisk' | 'key' | 'block' | 'spark'
  | 'anchor' | 'tool' | 'chevron-r' | 'ring' | 'tilde' | 'x'
  | 'minus' | 'flag' | 'approx' | 'arrows-lr'

export interface EdgeTypeDef {
  cat: EdgeCategory
  line: 'solid' | 'dashed' | 'dotted' | 'double' | 'wavy'
  glyph: GlyphKind
  symmetric: boolean
  label: string
}

/** Canonical category labels and prompts. */
export const RELATION_CATEGORY_META: Record<EdgeCategory, { label: string; subtitle: string }> = {
  taxonomic:  { label: 'Taxonomic',  subtitle: 'What kind of thing?' },
  structural: { label: 'Structural', subtitle: "What's it made of?" },
  causal:     { label: 'Causal',     subtitle: 'What does it do?' },
  dependency: { label: 'Dependency', subtitle: 'What does it need?' },
  temporal:   { label: 'Temporal',   subtitle: 'When? Where?' },
  opposition: { label: 'Opposition', subtitle: 'What does it contrast with?' },
  similarity: { label: 'Similarity', subtitle: 'What is it like?' },
}

export const RELATION_TYPES: Record<EdgeTypeName, EdgeTypeDef> = {
  'is-a':           { cat: 'taxonomic',  line: 'solid',  glyph: 'triangle-up',  symmetric: false, label: 'is a' },
  'instance-of':    { cat: 'taxonomic',  line: 'solid',  glyph: 'circle-dot',   symmetric: false, label: 'instance of' },
  'subtype-of':     { cat: 'taxonomic',  line: 'double', glyph: 'triangle-up',  symmetric: false, label: 'subtype of' },

  'part-of':        { cat: 'structural', line: 'solid',  glyph: 'diamond',      symmetric: false, label: 'part of' },
  'made-of':        { cat: 'structural', line: 'dashed', glyph: 'hash',         symmetric: false, label: 'made of' },
  'contains':       { cat: 'structural', line: 'solid',  glyph: 'diamond-open', symmetric: false, label: 'contains' },

  'causes':         { cat: 'causal',     line: 'solid',  glyph: 'arrow-right',  symmetric: false, label: 'causes' },
  'produces':       { cat: 'causal',     line: 'solid',  glyph: 'asterisk',     symmetric: false, label: 'produces' },
  'enables':        { cat: 'causal',     line: 'dotted', glyph: 'key',          symmetric: false, label: 'enables' },
  'prevents':       { cat: 'causal',     line: 'dotted', glyph: 'block',        symmetric: false, label: 'prevents' },
  'triggers':       { cat: 'causal',     line: 'solid',  glyph: 'spark',        symmetric: false, label: 'triggers' },
  'inhibits':       { cat: 'causal',     line: 'dotted', glyph: 'minus',        symmetric: false, label: 'inhibits' },

  'requires':       { cat: 'dependency', line: 'solid',  glyph: 'anchor',       symmetric: false, label: 'requires' },
  'uses':           { cat: 'dependency', line: 'dashed', glyph: 'tool',         symmetric: false, label: 'uses' },
  'used-for':       { cat: 'dependency', line: 'dashed', glyph: 'flag',         symmetric: false, label: 'used for' },

  'precedes':       { cat: 'temporal',   line: 'solid',  glyph: 'chevron-r',    symmetric: false, label: 'precedes' },
  'occurs-in':      { cat: 'temporal',   line: 'dotted', glyph: 'ring',         symmetric: false, label: 'occurs in' },

  'contrasts-with': { cat: 'opposition', line: 'wavy',   glyph: 'tilde',        symmetric: true,  label: 'contrasts with' },
  'opposite-of':    { cat: 'opposition', line: 'double', glyph: 'x',            symmetric: true,  label: 'opposite of' },

  'similar-to':     { cat: 'similarity', line: 'dashed', glyph: 'approx',       symmetric: true,  label: 'similar to' },
  'analogous-to':   { cat: 'similarity', line: 'dotted', glyph: 'arrows-lr',    symmetric: true,  label: 'analogous to' },
}

export const RELATION_TYPE_VALUES = Object.keys(RELATION_TYPES) as EdgeTypeName[]
