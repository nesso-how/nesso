// SPDX-License-Identifier: MIT
import understanding from '@/data/seeds/understanding.json'
import comprensione from '@/data/seeds/it/comprensione.json'
import type { Node, Edge } from '@xyflow/react'
import type {
  ConceptNodeData,
  Language,
  GraphDisplaySettings,
  EdgeEncoding,
  CurveStyle,
} from '@/types/graph'
import { defaultGraphDisplay } from '@/types/graph'

export interface Seed {
  id: string
  name: string
  nodes: Node<ConceptNodeData>[]
  edges: Edge[]
  display?: GraphDisplaySettings
  /** Auto-fit zoom multiplier on first load (< 1 zooms out). */
  initialFitZoom?: number
}

/** Stable random ids for bundled seeds (not derived from titles). */
const SEED_IDS = {
  understanding: 'g7k2mp9xqn14v2',
  comprensione: 'gn5qw2bkf8sl6x',
} as const

/** JSON seed files infer string literals as `string`; normalize before use. */
type SeedSource = {
  version?: number
  vocabulary?: { id: string; version: string }
  name: string
  nodes: unknown[]
  edges: unknown[]
  display?: {
    edgeEncoding?: string
    showHeatmap?: boolean
    curveStyle?: string
    autoCurveFlip?: boolean
  }
}

function normalizeSeedDisplay(display: NonNullable<SeedSource['display']>): GraphDisplaySettings {
  const base = defaultGraphDisplay()
  return {
    edgeEncoding: (display.edgeEncoding as EdgeEncoding | undefined) ?? base.edgeEncoding,
    showHeatmap: display.showHeatmap ?? base.showHeatmap,
    curveStyle: (display.curveStyle as CurveStyle | undefined) ?? base.curveStyle,
    autoCurveFlip: display.autoCurveFlip ?? base.autoCurveFlip,
  }
}

function makeSeed(id: string, raw: SeedSource, opts?: Pick<Seed, 'initialFitZoom'>): Seed {
  return {
    id,
    name: raw.name,
    nodes: raw.nodes as Node<ConceptNodeData>[],
    edges: raw.edges as Edge[],
    display: raw.display ? normalizeSeedDisplay(raw.display) : undefined,
    initialFitZoom: opts?.initialFitZoom,
  }
}

/** Demo graph: slightly zoomed out on first auto-fit so labels breathe. */
const DEMO_INITIAL_FIT_ZOOM = 0.82

const enSeeds = [
  makeSeed(SEED_IDS.understanding, understanding, { initialFitZoom: DEMO_INITIAL_FIT_ZOOM }),
]
const itSeeds = [
  makeSeed(SEED_IDS.comprensione, comprensione, { initialFitZoom: DEMO_INITIAL_FIT_ZOOM }),
]

const seedById = new Map([...enSeeds, ...itSeeds].map((s) => [s.id, s]))

export function getSeedInitialFitZoom(graphId: string): number | undefined {
  return seedById.get(graphId)?.initialFitZoom
}

export const SEEDS = enSeeds

export function getSeedsForLanguage(lang: Language): Seed[] {
  return lang === 'it' ? itSeeds : enSeeds
}
