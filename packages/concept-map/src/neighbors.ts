type Link = { readonly source: string; readonly target: string; readonly predicate: string }

export type OutsideNeighbor = { readonly id: string; readonly relations: readonly Link[] }

export const outsideNeighbors = (
  relations: readonly Link[],
  members: ReadonlySet<string>,
): ReadonlyMap<string, readonly OutsideNeighbor[]> => {
  const found = new Map<string, Map<string, Link[]>>()
  for (const relation of relations)
    for (const [member, other] of [
      [relation.source, relation.target],
      [relation.target, relation.source],
    ]) {
      if (!members.has(member) || members.has(other)) continue
      const neighbors = found.get(member) ?? new Map<string, Link[]>()
      found.set(member, neighbors)
      neighbors.set(other, [...(neighbors.get(other) ?? []), relation])
    }
  return new Map(
    [...found].map(([member, neighbors]) => [
      member,
      [...neighbors].map(([id, relations]) => ({ id, relations })),
    ]),
  )
}
