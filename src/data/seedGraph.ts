// SPDX-License-Identifier: MIT
import understanding from '@/data/seeds/understanding.json'
import comprensione from '@/data/seeds/it/comprensione.json'
import type { Language } from '@/types/graph'

export interface Seed {
  id: string
  name: string
  language: Language
  document: unknown
  /** Auto-fit zoom multiplier on first load (< 1 zooms out). */
  initialFitZoom?: number
}

/** Stable random ids for bundled seeds (not derived from titles). */
const SEED_IDS = {
  understanding: 'g7k2mp9xqn14v2',
  comprensione: 'gn5qw2bkf8sl6x',
} as const

function makeSeed(
  id: string,
  document: unknown,
  name: string,
  language: Language,
  opts?: Pick<Seed, 'initialFitZoom'>,
): Seed {
  return { id, document, name, language, ...opts }
}

/** Demo graph: slightly zoomed out on first auto-fit so labels breathe. */
const DEMO_INITIAL_FIT_ZOOM = 0.82

const enSeeds = [
  makeSeed(SEED_IDS.understanding, understanding, 'Understanding', 'en', {
    initialFitZoom: DEMO_INITIAL_FIT_ZOOM,
  }),
]
const itSeeds = [
  makeSeed(SEED_IDS.comprensione, comprensione, 'Comprensione', 'it', {
    initialFitZoom: DEMO_INITIAL_FIT_ZOOM,
  }),
]

const seedById = new Map([...enSeeds, ...itSeeds].map((s) => [s.id, s]))

export function getSeedInitialFitZoom(graphId: string): number | undefined {
  return seedById.get(graphId)?.initialFitZoom
}

export const SEEDS = enSeeds

export function getSeedsForLanguage(lang: Language): Seed[] {
  return lang === 'it' ? itSeeds : enSeeds
}
