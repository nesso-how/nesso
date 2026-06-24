// SPDX-License-Identifier: MIT
//
// Visual encoding assets for relation types: category colour palettes (hex for
// embeds) and SVG glyph path data keyed by `GlyphKind` from `relationTypes.ts`.
import type { GlyphKind, RelationCategory } from './relationTypes.js'

export type CategoryPalette = 'default' | 'vivid' | 'muted' | 'monoCat'

/** Per-category hex colors for each named palette. */
export const PALETTES: Record<CategoryPalette, Record<RelationCategory, string>> = {
  default: {
    taxonomic: '#2f5d8e',
    structural: '#6b4a8a',
    causal: '#b14a2e',
    dependency: '#8a6a1a',
    temporal: '#2d6a55',
    opposition: '#8a2e4a',
    similarity: '#2a6878',
    epistemic: '#3a4a8a',
  },
  vivid: {
    taxonomic: '#0066cc',
    structural: '#9333ea',
    causal: '#dc2626',
    dependency: '#ea580c',
    temporal: '#0d9488',
    opposition: '#be185d',
    similarity: '#0891b2',
    epistemic: '#4338ca',
  },
  muted: {
    taxonomic: '#5a7896',
    structural: '#806894',
    causal: '#a86a52',
    dependency: '#9a8556',
    temporal: '#5a8276',
    opposition: '#9a586c',
    similarity: '#5a8090',
    epistemic: '#5a6896',
  },
  monoCat: {
    taxonomic: '#3a3a3a',
    structural: '#3a3a3a',
    causal: '#3a3a3a',
    dependency: '#3a3a3a',
    temporal: '#3a3a3a',
    opposition: '#3a3a3a',
    similarity: '#3a3a3a',
    epistemic: '#3a3a3a',
  },
}

/**
 * Raw SVG inner content for each glyph kind, on a 14×14 viewBox.
 * Uses `currentColor` for stroke/fill — set CSS `color` on the parent to tint.
 * Default stroke attrs: fill=none, stroke=currentColor, stroke-width=1.4,
 * stroke-linecap=round, stroke-linejoin=round.
 */
export const GLYPH_PATHS: Record<GlyphKind, string> = {
  'triangle-up': '<polygon points="7,3 11,10 3,10" fill="currentColor" stroke="none"/>',
  'circle-dot':
    '<circle cx="7" cy="7" r="5"/><circle cx="7" cy="7" r="1.6" fill="currentColor" stroke="none"/>',
  diamond: '<polygon points="7,2 12,7 7,12 2,7" fill="currentColor" stroke="none"/>',
  'diamond-open': '<polygon points="7,2 12,7 7,12 2,7"/>',
  hash: '<path d="M5 2v10M9 2v10M2 5h10M2 9h10"/>',
  'arrow-right': '<path d="M2 7h10M8 3l4 4-4 4"/>',
  asterisk: '<path d="M7 2v10M3 4l8 6M3 10l8-6"/>',
  key: '<circle cx="5" cy="7" r="2.4"/><path d="M7.4 7H12M10 7v2M11.5 7v1.5"/>',
  block: '<circle cx="7" cy="7" r="4.5"/><path d="M3.7 3.7l6.6 6.6"/>',
  spark: '<path d="M7 2v3M7 9v3M2 7h3M9 7h3M3.5 3.5l2 2M8.5 8.5l2 2M3.5 10.5l2-2M8.5 5.5l2-2"/>',
  anchor: '<circle cx="7" cy="4" r="1.5"/><path d="M7 5.5v6.5M3 9c0 2 2 3 4 3s4-1 4-3M4.5 8.5h5"/>',
  tool: '<path d="M9 2.5L11.5 5l-1.2 1.2-2.5-2.5zM10.3 6.2l-7 7-1.5-1.5 7-7"/>',
  'chevron-r': '<path d="M5 3l4 4-4 4M2 3l4 4-4 4"/>',
  ring: '<circle cx="7" cy="7" r="4.5"/>',
  tilde: '<path d="M2 8 Q4 5 7 7 T12 6"/>',
  x: '<path d="M3 3l8 8M11 3l-8 8" stroke-width="1.8"/>',
  minus: '<path d="M3 7h8" stroke-width="2"/>',
  flag: '<path d="M4 12V2M4 2l7 3.5L4 9"/>',
  approx: '<path d="M2 5 Q4 3 7 5 T12 5"/><path d="M2 9 Q4 7 7 9 T12 9"/>',
  'arrows-lr': '<path d="M2 7h10M3.5 4.5L2 7l1.5 2.5M10.5 4.5L12 7l-1.5 2.5"/>',
  check: '<path d="M2.5 7.5l3 3 6-7"/>',
  slash: '<path d="M11 3l-8 8" stroke-width="1.8"/>',
  bulb: '<path d="M7 2a3.2 3.2 0 0 0-2 5.7c.4.4.7.9.7 1.5v.3h2.6v-.3c0-.6.3-1.1.7-1.5A3.2 3.2 0 0 0 7 2zM5.7 10.5h2.6M6.2 12h1.6"/>',
  equals: '<path d="M3 5.5h8M3 8.5h8" stroke-width="1.8"/>',
  lock: '<rect x="3.5" y="6.5" width="7" height="5.5" rx="0.8"/><path d="M5 6.5V4.5a2 2 0 0 1 4 0v2"/>',
  flame:
    '<path d="M7 2c-1 2.2-3 3.4-3 6a3 3 0 0 0 6 0c0-1.2-.6-2-1.4-2.6.2 1.2-.4 2.2-1.4 2C7.4 5.6 7.8 4 7 2z"/>',
  hourglass: '<path d="M3.5 2.5h7M3.5 11.5h7M4 2.5v1.5L7 7l3-3V2.5M4 11.5v-1.5L7 7l3 3v1.5"/>',
  brackets: '<path d="M4 3h-1.5v8H4M10 3h1.5v8H10"/>',
  overlap: '<path d="M2 5.5h7M5 8.5h7" stroke-width="1.8"/>',
  branch: '<path d="M7 2v10M7 7l-3 3M7 7l3 3"/>',
}
