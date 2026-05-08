// SPDX-License-Identifier: MIT
import seedData from '@/data/seeds/plant-biology.json'
import type { Node, Edge } from '@xyflow/react'
import type { ConceptNodeData } from '@/types/graph'

export const SEED_NAME: string = seedData.name
export const SEED_NODES = seedData.nodes as Node<ConceptNodeData>[]
export const SEED_EDGES = seedData.edges as Edge[]
