// SPDX-License-Identifier: MIT
import type { Node } from '@xyflow/react'
import type { ConceptNodeData } from '@/types/graph'

function roughTokens(s: string): number {
  return Math.ceil(s.length / 4)
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, Math.max(0, n - 1)).replace(/\s+\S*$/, '') + '…'
}

/** FSRS-aware strength for mentor prompts: lower sorts earlier (weakest first).
 * Stability dominates; Again/Hard and light overdue tighten ordering; scheduler DUE stays a tie-breaker. */
export function nodeStrength(n: Node<ConceptNodeData>): number {
  if (n.data.reps === 0) return -Infinity
  let strength = Math.max(n.data.stability, 1e-9)
  switch (n.data.lastRating) {
    case 1:
      strength *= 0.86
      break
    case 2:
      strength *= 0.93
      break
    default:
      break
  }
  const overdue = n.data.due > 0 && n.data.due <= Date.now()
  if (overdue) strength *= 0.965
  return strength
}

const FOCUS_MAX_TOKENS = 400
const RELATED_MAX_TOKENS = 300
const NEIGHBOR_DEF_CHARS = 120
/** Caps review-question user prompt elaboration size (definition + examples + notes). */
const REVIEW_ELAB_MAX_TOKENS = 350

export interface FocalNeighborContext {
  focus: string
  related: string
}

export function buildFocalNeighborContext(
  focal: Node<ConceptNodeData> | null,
  neighbors: Node<ConceptNodeData>[],
): FocalNeighborContext {
  if (!focal) return { focus: '', related: '' }
  const focus = renderFocus(focal)
  const sortedNeighbors = [...neighbors].sort((a, b) => nodeStrength(b) - nodeStrength(a))
  const related = renderRelated(sortedNeighbors)
  return { focus, related }
}

function renderFocus(node: Node<ConceptNodeData>): string {
  const elab = node.data.elaboration
  if (!elab) return ''
  const parts: string[] = []
  const def = elab.definition?.trim()
  if (def) parts.push(def)
  const exs = (elab.examples ?? '').split('\n').map(s => s.trim()).filter(Boolean)
  if (exs.length > 0) parts.push(`Examples: ${exs.join('; ')}`)
  const notes = elab.notes?.trim()
  if (notes) parts.push(`Notes: ${notes}`)
  if (parts.length === 0) return ''
  let body = parts.join(' ')
  if (roughTokens(body) > FOCUS_MAX_TOKENS) body = truncate(body, FOCUS_MAX_TOKENS * 4)
  return `"${node.data.text}": ${body}`
}

function renderRelated(neighbors: Node<ConceptNodeData>[]): string {
  const out: string[] = []
  let budget = RELATED_MAX_TOKENS
  for (const n of neighbors) {
    const def = n.data.elaboration?.definition?.trim()
    if (!def) continue
    const piece = `"${n.data.text}": ${truncate(def, NEIGHBOR_DEF_CHARS)}`
    const cost = roughTokens(piece)
    if (cost > budget) break
    out.push(piece)
    budget -= cost
  }
  return out.join('; ')
}

/** Lined context from the node's elaboration for FSRS review question generation. */
export function buildReviewElaborationPrompt(node: Node<ConceptNodeData>): string {
  const elab = node.data.elaboration
  if (!elab) return ''
  const parts: string[] = []
  const def = elab.definition?.trim()
  if (def) parts.push(`Definition: ${def}`)
  const exs = (elab.examples ?? '').split('\n').map(s => s.trim()).filter(Boolean)
  if (exs.length > 0) parts.push(`Examples: ${exs.join('; ')}`)
  const notes = elab.notes?.trim()
  if (notes) parts.push(`Notes: ${notes}`)
  if (parts.length === 0) return ''
  let body = parts.join('\n')
  if (roughTokens(body) > REVIEW_ELAB_MAX_TOKENS) body = truncate(body, REVIEW_ELAB_MAX_TOKENS * 4)
  return body
}

export function oneHopNeighborIds(focalId: string, edges: { source: string; target: string }[]): string[] {
  const set = new Set<string>()
  for (const e of edges) {
    if (e.source === focalId) set.add(e.target)
    else if (e.target === focalId) set.add(e.source)
  }
  return Array.from(set)
}
