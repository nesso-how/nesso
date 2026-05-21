// SPDX-License-Identifier: MIT
import understanding from '@/data/seeds/understanding.json'
import plantBiology from '@/data/seeds/plant-biology.json'
import comprensione from '@/data/seeds/it/comprensione.json'
import biologiaVegetale from '@/data/seeds/it/biologia-vegetale.json'
import type { Node, Edge } from '@xyflow/react'
import type { ConceptNodeData, Language, GraphDisplaySettings, EdgeEncoding, CurveStyle } from '@/types/graph'
import { defaultGraphDisplay } from '@/types/graph'

export interface Seed {
  id: string
  name: string
  nodes: Node<ConceptNodeData>[]
  edges: Edge[]
  display?: GraphDisplaySettings
}

/** Stable random ids for bundled seeds (not derived from titles). */
const SEED_IDS = {
  understanding: 'g7k2mp9xqn14v2',
  plantBiology: 'gr3ht8cyp1nm5j',
  comprensione: 'gn5qw2bkf8sl6x',
  biologiaVegetale: 'gj4pv9dmh2rt7c',
} as const

/** JSON seed files infer string literals as `string`; normalize before use. */
type SeedSource = {
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

function normalizeSeedDisplay(
  display: NonNullable<SeedSource['display']>,
): GraphDisplaySettings {
  const base = defaultGraphDisplay()
  return {
    edgeEncoding: (display.edgeEncoding as EdgeEncoding | undefined) ?? base.edgeEncoding,
    showHeatmap: display.showHeatmap ?? base.showHeatmap,
    curveStyle: (display.curveStyle as CurveStyle | undefined) ?? base.curveStyle,
    autoCurveFlip: display.autoCurveFlip ?? base.autoCurveFlip,
  }
}

function makeSeed(id: string, raw: SeedSource): Seed {
  return {
    id,
    name: raw.name,
    nodes: raw.nodes as Node<ConceptNodeData>[],
    edges: raw.edges as Edge[],
    display: raw.display ? normalizeSeedDisplay(raw.display) : undefined,
  }
}

const enSeeds = [
  makeSeed(SEED_IDS.understanding, understanding),
  makeSeed(SEED_IDS.plantBiology, plantBiology),
]
const itSeeds = [
  makeSeed(SEED_IDS.comprensione, comprensione),
  makeSeed(SEED_IDS.biologiaVegetale, biologiaVegetale),
]

export const SEEDS = enSeeds

export function getSeedsForLanguage(lang: Language): Seed[] {
  return lang === 'it' ? itSeeds : enSeeds
}
