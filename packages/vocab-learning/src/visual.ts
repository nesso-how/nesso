// SPDX-License-Identifier: MIT
//
// Visual encoding assets for relation types: category colour palettes (hex for
// embeds).
import type { RelationCategory } from './relationTypes.js'

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
 * CSS variable map for a category palette (`--cat-<category>` → hex).
 * Single emitter for the category→CSS-variable map so app and docs shells
 * never duplicate the naming or the palette lookup.
 */
export function categoryCssVars(palette: CategoryPalette): Record<string, string> {
  const resolved = PALETTES[palette] ?? PALETTES.default
  return Object.fromEntries(
    Object.entries(resolved).map(([category, hex]) => [`--cat-${category}`, hex]),
  )
}
