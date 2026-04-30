import type { CategoryPalette } from '@/types/graph'

export const PALETTES: Record<CategoryPalette, Record<string, string>> = {
  default:  { taxonomic: '#2f5d8e', structural: '#6b4a8a', causal: '#b14a2e', dependency: '#8a6a1a', temporal: '#2d6a55', opposition: '#8a2e4a' },
  vivid:    { taxonomic: '#0066cc', structural: '#9333ea', causal: '#dc2626', dependency: '#ea580c', temporal: '#0d9488', opposition: '#be185d' },
  muted:    { taxonomic: '#5a7896', structural: '#806894', causal: '#a86a52', dependency: '#9a8556', temporal: '#5a8276', opposition: '#9a586c' },
  monoCat:  { taxonomic: '#3a3a3a', structural: '#3a3a3a', causal: '#3a3a3a', dependency: '#3a3a3a', temporal: '#3a3a3a', opposition: '#3a3a3a' },
}
