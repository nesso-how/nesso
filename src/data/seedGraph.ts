// SPDX-License-Identifier: MIT
import plantBiology from '@/data/seeds/plant-biology.json'
import solarSystem from '@/data/seeds/solar-system.json'
import type { Node, Edge } from '@xyflow/react'
import type { ConceptNodeData } from '@/types/graph'

export interface Seed {
  id: string
  name: string
  nodes: Node<ConceptNodeData>[]
  edges: Edge[]
}

function seedIdFromName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

const raw = [plantBiology, solarSystem]

export const SEEDS: Seed[] = raw.map(s => ({
  id: seedIdFromName(s.name),
  name: s.name,
  nodes: s.nodes as Node<ConceptNodeData>[],
  edges: s.edges as Edge[],
}))
