export type Position = { x: number; y: number }
export type Concept = { id: string; label: string; tags: string[]; position: Position }
export type RelationType = { id: string; label: string }
export type Relation = { source: string; predicate: string; target: string }

export type Graph = {
  concepts: Concept[]
  relationTypes: RelationType[]
  relations: Relation[]
}
