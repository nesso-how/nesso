// SPDX-License-Identifier: MIT
import type { ConceptNodeData, EdgeTypeName } from '@/types/graph'
import { CONCEPT_HANDLE_IN, CONCEPT_HANDLE_OUT } from '@/data/conceptHandles'
import type { Node, Edge } from '@xyflow/react'

let _id = 0
const nid = () => `n${++_id}`

type RawNode = { text: string; conf: number; reviewed: number; x: number; y: number }

const RAW_NODES: RawNode[] = [
  { text: 'Seed',           conf: 5, reviewed: 3,  x:   342, y:  -89 },
  { text: 'Germination',    conf: 3, reviewed: 10, x:   -75, y:  -12 },
  { text: 'Plant',          conf: 5, reviewed: 2,  x:   -77, y:  176 },
  { text: 'Root',           conf: 4, reviewed: 3,  x:  -315, y:  515 },
  { text: 'Stem',           conf: 4, reviewed: 4,  x:   267, y:  291 },
  { text: 'Leaf',           conf: 5, reviewed: 2,  x:  -425, y:  174 },
  { text: 'Flower',         conf: 4, reviewed: 5,  x:   259, y:  442 },
  { text: 'Fruit',          conf: 5, reviewed: 4,  x:   414, y:  209 },
  { text: 'Water',          conf: 5, reviewed: 1,  x:   201, y:  -10 },
  { text: 'Sunlight',       conf: 5, reviewed: 1,  x:  -333, y:  -72 },
  { text: 'Soil',           conf: 4, reviewed: 6,  x:  -325, y:  337 },
  { text: 'Carbon dioxide', conf: 3, reviewed: 8,  x:  -563, y: -106 },
  { text: 'Photosynthesis', conf: 3, reviewed: 14, x:  -675, y:  154 },
  { text: 'Oxygen',         conf: 4, reviewed: 7,  x: -1013, y:  411 },
  { text: 'Glucose',        conf: 2, reviewed: 18, x:  -534, y:  378 },
  { text: 'Chlorophyll',    conf: 2, reviewed: 21, x:  -900, y:  -42 },
  { text: 'Pollination',    conf: 3, reviewed: 12, x:   640, y:  200 },
  { text: 'Respiration',    conf: 2, reviewed: 25, x:  -772, y:  423 },
  { text: 'Annual',         conf: 3, reviewed: 15, x:  -129, y:  528 },
  { text: 'Perennial',      conf: 3, reviewed: 15, x:   104, y:  493 },
]

type RawEdge = { from: string; to: string; type: EdgeTypeName }

const RAW_EDGES: RawEdge[] = [
  // Taxonomic
  { from: 'Annual',           to: 'Plant',           type: 'subtype-of' },
  { from: 'Perennial',        to: 'Plant',           type: 'subtype-of' },
  // Structural
  { from: 'Root',             to: 'Plant',           type: 'part-of' },
  { from: 'Stem',             to: 'Plant',           type: 'part-of' },
  { from: 'Leaf',             to: 'Plant',           type: 'part-of' },
  { from: 'Flower',           to: 'Plant',           type: 'part-of' },
  { from: 'Fruit',            to: 'Plant',           type: 'part-of' },
  { from: 'Fruit',            to: 'Seed',            type: 'contains' },
  // Causal
  { from: 'Sunlight',         to: 'Photosynthesis',  type: 'enables' },
  { from: 'Carbon dioxide',   to: 'Photosynthesis',  type: 'enables' },
  { from: 'Chlorophyll',      to: 'Photosynthesis',  type: 'enables' },
  { from: 'Photosynthesis',   to: 'Oxygen',          type: 'produces' },
  { from: 'Photosynthesis',   to: 'Glucose',         type: 'produces' },
  { from: 'Flower',           to: 'Pollination',     type: 'enables' },
  { from: 'Pollination',      to: 'Fruit',           type: 'produces' },
  // Dependency
  { from: 'Plant',            to: 'Water',           type: 'requires' },
  { from: 'Plant',            to: 'Sunlight',        type: 'requires' },
  { from: 'Plant',            to: 'Soil',            type: 'requires' },
  { from: 'Photosynthesis',   to: 'Chlorophyll',     type: 'requires' },
  { from: 'Germination',      to: 'Water',           type: 'requires' },
  { from: 'Root',             to: 'Soil',            type: 'uses' },
  { from: 'Leaf',             to: 'Sunlight',        type: 'uses' },
  // Temporal
  { from: 'Seed',             to: 'Germination',     type: 'precedes' },
  { from: 'Germination',      to: 'Plant',           type: 'precedes' },
  { from: 'Flower',           to: 'Fruit',           type: 'precedes' },
  // Opposition
  { from: 'Photosynthesis',   to: 'Respiration',     type: 'opposite-of' },
  { from: 'Annual',           to: 'Perennial',       type: 'opposite-of' },
]

export function makeSeedGraph(): { nodes: Node<ConceptNodeData>[]; edges: Edge[] } {
  const idMap: Record<string, string> = {}
  const nodes: Node<ConceptNodeData>[] = RAW_NODES.map(n => {
    const id = nid()
    idMap[n.text] = id
    return {
      id,
      type: 'concept',
      position: { x: n.x, y: n.y },
      data: { text: n.text, conf: n.conf, reviewedAt: Date.now() - n.reviewed * 86_400_000 },
    }
  })
  const edges: Edge[] = RAW_EDGES.map((e, i) => ({
    id: `e${i}`,
    source: idMap[e.from],
    target: idMap[e.to],
    sourceHandle: CONCEPT_HANDLE_OUT,
    targetHandle: CONCEPT_HANDLE_IN,
    type: 'nesso',
    data: { type: e.type },
  }))
  return { nodes, edges }
}

export const SOCRATIC_PROMPTS = [
  { trigger: 'start', text: 'You drew "Seed precedes Germination precedes Plant." Good start. But what exactly triggers germination — is water alone enough, or does something else need to happen first?' },
  { trigger: 'node:Photosynthesis', text: "You marked Photosynthesis as confidence 3/5 and haven't reviewed it in two weeks. Quick check: what are the three things it requires, and what two things does it produce?" },
  { trigger: 'node:Fruit', text: "Fruit comes from Pollination here. Always? What about self-pollinating plants, or fruits that form without any pollination at all?" },
  { trigger: 'edge:opposite-of', text: "You marked Photosynthesis and Respiration as opposites. Are they truly opposites, or two sides of the same energy loop? Could 'contrasts-with' be more precise?" },
  { trigger: 'node:Chlorophyll', text: "Chlorophyll enables Photosynthesis — but it also lives inside the leaf. Should it appear as part-of Leaf, or is it more accurate as a required ingredient for a process?" },
  { trigger: 'idle', text: "'Glucose' has confidence 2/5 and was last reviewed 18 days ago. Can you trace the full path from Sunlight to Glucose in the graph without looking it up?" },
]
