// SPDX-License-Identifier: AGPL-3.0
import type { ConceptNodeData, EdgeTypeName } from '@/types/graph'
import { CONCEPT_HANDLE_IN, CONCEPT_HANDLE_OUT } from '@/data/conceptHandles'
import type { Node, Edge } from '@xyflow/react'

let _id = 0
const nid = () => `n${++_id}`

type RawNode = { text: string; conf: number; reviewed: number; x: number; y: number; pinned?: boolean }

const RAW_NODES: RawNode[] = [
  { text: 'Source code',       conf: 5, reviewed: 2,  x: -460, y: -180, pinned: true },
  { text: 'Compiler',         conf: 4, reviewed: 4,  x: -180, y: -180, pinned: true },
  { text: 'Bytecode',         conf: 4, reviewed: 7,  x:   80, y: -260 },
  { text: 'Machine code',     conf: 3, reviewed: 12, x:   80, y: -100 },
  { text: 'Interpreter',      conf: 4, reviewed: 6,  x: -180, y:  -20 },
  { text: 'Runtime',          conf: 5, reviewed: 1,  x:  340, y: -180, pinned: true },
  { text: 'Heap',             conf: 4, reviewed: 5,  x:  580, y: -300 },
  { text: 'Stack',            conf: 5, reviewed: 3,  x:  580, y: -180 },
  { text: 'Garbage collection', conf: 2, reviewed: 21, x: 840, y: -300 },
  { text: 'Memory leak',      conf: 3, reviewed: 14, x:  840, y: -180 },
  { text: 'Reference counting', conf: 2, reviewed: 30, x: 1020, y: -380 },
  { text: 'Mark-and-sweep',   conf: 3, reviewed: 18, x: 1020, y: -260 },
  { text: 'Process',          conf: 5, reviewed: 2,  x:  340, y:   60 },
  { text: 'Thread',           conf: 4, reviewed: 8,  x:  580, y:   40 },
  { text: 'Mutex',            conf: 3, reviewed: 11, x:  840, y:   20 },
  { text: 'Race condition',   conf: 2, reviewed: 19, x:  840, y:  140 },
  { text: 'Deadlock',         conf: 2, reviewed: 25, x: 1080, y:   80 },
  { text: 'Static typing',    conf: 4, reviewed: 9,  x: -460, y:  120 },
  { text: 'Dynamic typing',   conf: 4, reviewed: 9,  x: -180, y:  180 },
  { text: 'Type system',      conf: 4, reviewed: 6,  x: -460, y:  -20 },
]

type RawEdge = { from: string; to: string; type: EdgeTypeName }

const RAW_EDGES: RawEdge[] = [
  { from: 'Compiler',          to: 'Process',            type: 'is-a' },
  { from: 'Interpreter',       to: 'Process',            type: 'is-a' },
  { from: 'Static typing',     to: 'Type system',        type: 'subtype-of' },
  { from: 'Dynamic typing',    to: 'Type system',        type: 'subtype-of' },
  { from: 'Mark-and-sweep',    to: 'Garbage collection', type: 'instance-of' },
  { from: 'Reference counting',to: 'Garbage collection', type: 'instance-of' },
  { from: 'Heap',              to: 'Runtime',            type: 'part-of' },
  { from: 'Stack',             to: 'Runtime',            type: 'part-of' },
  { from: 'Thread',            to: 'Process',            type: 'part-of' },
  { from: 'Runtime',          to: 'Heap',               type: 'contains' },
  { from: 'Compiler',         to: 'Bytecode',           type: 'produces' },
  { from: 'Compiler',         to: 'Machine code',       type: 'produces' },
  { from: 'Memory leak',      to: 'Heap',               type: 'occurs-in' },
  { from: 'Garbage collection', to: 'Memory leak',      type: 'prevents' },
  { from: 'Race condition',   to: 'Deadlock',           type: 'causes' },
  { from: 'Mutex',            to: 'Race condition',     type: 'prevents' },
  { from: 'Thread',           to: 'Race condition',     type: 'enables' },
  { from: 'Interpreter',      to: 'Source code',        type: 'requires' },
  { from: 'Compiler',         to: 'Source code',        type: 'requires' },
  { from: 'Process',          to: 'Stack',              type: 'uses' },
  { from: 'Garbage collection', to: 'Heap',             type: 'uses' },
  { from: 'Source code',      to: 'Compiler',           type: 'precedes' },
  { from: 'Compiler',         to: 'Runtime',            type: 'precedes' },
  { from: 'Mutex',            to: 'Thread',             type: 'occurs-in' },
  { from: 'Static typing',    to: 'Dynamic typing',     type: 'opposite-of' },
  { from: 'Compiler',         to: 'Interpreter',        type: 'contrasts-with' },
  { from: 'Heap',             to: 'Stack',              type: 'contrasts-with' },
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
      data: { text: n.text, conf: n.conf, reviewedAt: Date.now() - n.reviewed * 86_400_000, pinned: n.pinned ?? false },
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
  { trigger: 'start', text: 'You drew "Mark-and-sweep is an instance of garbage collection." Good. Now — what would change if you replaced it with reference counting? Where would the graph break?' },
  { trigger: 'node:Garbage collection', text: "You're confident about garbage collection (4/5), but you reviewed it 3 weeks ago. Quick check: can you name a case where mark-and-sweep wins over reference counting?" },
  { trigger: 'node:Race condition', text: "Race condition causes deadlock here. Always? Or only sometimes? Tighten the relation — maybe 'enables' fits better than 'causes.'" },
  { trigger: 'edge:opposite-of', text: 'You marked static and dynamic typing as opposites. Are they truly opposites, or two points on a spectrum? Try adding a node between them.' },
  { trigger: 'node:Compiler', text: 'Compiler produces bytecode, but only sometimes — a C compiler skips that step. Should the edge be conditional, or do you need a subtype?' },
  { trigger: 'idle', text: "'Memory leak' has confidence 3/5 and hasn't been reviewed in two weeks. Want to talk it through?" },
]
