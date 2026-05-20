// SPDX-License-Identifier: MIT
import understanding from '@/data/seeds/understanding.json'
import plantBiology from '@/data/seeds/plant-biology.json'
import comprensione from '@/data/seeds/it/comprensione.json'
import biologiaVegetale from '@/data/seeds/it/biologia-vegetale.json'
import type { Node, Edge } from '@xyflow/react'
import type { ConceptNodeData, Language, GraphDisplaySettings } from '@/types/graph'

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

function makeSeed(raw: {
  name: string
  nodes: unknown[]
  edges: unknown[]
  display?: GraphDisplaySettings
}): Seed {
  return {
    id: seedIdFromName(raw.name),
    name: raw.name,
    nodes: raw.nodes as Node<ConceptNodeData>[],
    edges: raw.edges as Edge[],
    display: raw.display,
  }
}

const enSeeds = [understanding, plantBiology].map(makeSeed)
const itSeeds = [comprensione, biologiaVegetale].map(makeSeed)

export const SEEDS = enSeeds
export const ALL_SEEDS = [...enSeeds, ...itSeeds]

export function getSeedsForLanguage(lang: Language): Seed[] {
  return lang === 'it' ? itSeeds : enSeeds
}
