// SPDX-License-Identifier: MIT
import plantBiology from '@/data/seeds/plant-biology.json'
import solarSystem from '@/data/seeds/solar-system.json'
import biologiaVegetale from '@/data/seeds/it/biologia-vegetale.json'
import sistemaSolare from '@/data/seeds/it/sistema-solare.json'
import type { Node, Edge } from '@xyflow/react'
import type { ConceptNodeData, Language } from '@/types/graph'

export interface Seed {
  id: string
  name: string
  nodes: Node<ConceptNodeData>[]
  edges: Edge[]
}

function seedIdFromName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function makeSeed(raw: { name: string; nodes: unknown[]; edges: unknown[] }): Seed {
  return {
    id: seedIdFromName(raw.name),
    name: raw.name,
    nodes: raw.nodes as Node<ConceptNodeData>[],
    edges: raw.edges as Edge[],
  }
}

const enSeeds = [plantBiology, solarSystem].map(makeSeed)
const itSeeds = [biologiaVegetale, sistemaSolare].map(makeSeed)

export const SEEDS = enSeeds
export const ALL_SEEDS = [...enSeeds, ...itSeeds]

export function getSeedsForLanguage(lang: Language): Seed[] {
  return lang === 'it' ? itSeeds : enSeeds
}
