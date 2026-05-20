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

function seedIdFromName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

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

function makeSeed(raw: SeedSource): Seed {
  return {
    id: seedIdFromName(raw.name),
    name: raw.name,
    nodes: raw.nodes as Node<ConceptNodeData>[],
    edges: raw.edges as Edge[],
    display: raw.display ? normalizeSeedDisplay(raw.display) : undefined,
  }
}

const enSeeds = [understanding, plantBiology].map(makeSeed)
const itSeeds = [comprensione, biologiaVegetale].map(makeSeed)

export const SEEDS = enSeeds
export const ALL_SEEDS = [...enSeeds, ...itSeeds]

export function getSeedsForLanguage(lang: Language): Seed[] {
  return lang === 'it' ? itSeeds : enSeeds
}
