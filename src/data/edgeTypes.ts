// SPDX-License-Identifier: MIT
import type { EdgeCategory, EdgeTypeDef, EdgeTypeName } from '@/types/graph'

export const EDGE_CATEGORIES: Record<EdgeCategory, { label: string; color: string; subtitle: string }> = {
  taxonomic:  { label: 'Taxonomic',  color: 'var(--cat-taxonomic)',  subtitle: 'What kind of thing?' },
  structural: { label: 'Structural', color: 'var(--cat-structural)', subtitle: "What's it made of?" },
  causal:     { label: 'Causal',     color: 'var(--cat-causal)',     subtitle: 'What does it do?' },
  dependency: { label: 'Dependency', color: 'var(--cat-dependency)', subtitle: 'What does it need?' },
  temporal:   { label: 'Temporal',   color: 'var(--cat-temporal)',   subtitle: 'When? Where?' },
  opposition: { label: 'Opposition', color: 'var(--cat-opposition)', subtitle: 'What does it contrast with?' },
}

export const EDGE_TYPES: Record<EdgeTypeName, EdgeTypeDef> = {
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

  'requires':       { cat: 'dependency', line: 'solid',  glyph: 'anchor',       symmetric: false, label: 'requires' },
  'uses':           { cat: 'dependency', line: 'dashed', glyph: 'tool',         symmetric: false, label: 'uses' },

  'precedes':       { cat: 'temporal',   line: 'solid',  glyph: 'chevron-r',    symmetric: false, label: 'precedes' },
  'occurs-in':      { cat: 'temporal',   line: 'dotted', glyph: 'ring',         symmetric: false, label: 'occurs in' },

  'contrasts-with': { cat: 'opposition', line: 'wavy',   glyph: 'tilde',        symmetric: true,  label: 'contrasts with' },
  'opposite-of':    { cat: 'opposition', line: 'double', glyph: 'x',            symmetric: true,  label: 'opposite of' },
}
