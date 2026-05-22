---
title: Relation types
description: The 34 semantic relation types across 7 categories in Nesso.
---

Edges in Nesso carry a **semantic type**: a named relation that describes how two concepts are connected. There are 34 types grouped into 7 categories. Each category has a distinct colour; each type has a line style, a glyph, and a set of semantic coefficients used by graph-analysis algorithms.

Asymmetric relations come in **inverse pairs** (e.g. `subtype-of` / `has-subtype`) so traversal in either direction is first-class. Symmetric relations (opposition, similarity) are self-inverse.

## Coefficients

Each relation type declares:

- **`symmetric`** — `true` when the edge carries the same meaning in both directions (no arrowhead).
- **`transitive`** — `Y` (strict), `N` (none), or `weak` (transitivity with decay; algorithms may discount per step).
- **`inverse`** — the canonical inverse type in the set. Self for symmetric relations.
- **`strength`** — per-type semantic weight in `0..1`. Encodes how "tight" the relation is, not per-edge confidence.
- **`polarity`** — `+1` positive effect, `-1` antagonistic, `0` neutral/structural. From signed-network theory.
- **`cardinality`** — expected mapping pattern: `1-1`, `1-N`, `N-1`, or `N-N` (no constraint).

## Taxonomic

*What kind of thing is it?*

| Type | Label | Inverse | T | S | P | Card |
|------|-------|---------|---|---|---|------|
| `subtype-of` | subtype of | `has-subtype` | Y | 0.90 | 0 | N-1 |
| `has-subtype` | has subtype | `subtype-of` | Y | 0.90 | 0 | 1-N |
| `instance-of` | instance of | `has-instance` | N | 0.95 | 0 | N-1 |
| `has-instance` | has instance | `instance-of` | N | 0.95 | 0 | 1-N |

## Structural

*What is it made of or composed from?*

| Type | Label | Inverse | T | S | P | Card |
|------|-------|---------|---|---|---|------|
| `part-of` | part of | `contains` | Y | 0.85 | 0 | N-1 |
| `contains` | contains | `part-of` | Y | 0.85 | 0 | 1-N |
| `made-of` | made of | `composes` | weak | 0.75 | 0 | N-N |
| `composes` | composes | `made-of` | weak | 0.75 | 0 | N-N |

## Causal

*What does it do or prevent?*

| Type | Label | Inverse | T | S | P | Card |
|------|-------|---------|---|---|---|------|
| `causes` | causes | `caused-by` | N | 0.85 | +1 | N-N |
| `caused-by` | caused by | `causes` | N | 0.85 | +1 | N-N |
| `produces` | produces | `produced-by` | N | 0.70 | +1 | N-N |
| `produced-by` | produced by | `produces` | N | 0.70 | +1 | N-N |
| `enables` | enables | `enabled-by` | weak | 0.60 | +1 | N-N |
| `enabled-by` | enabled by | `enables` | weak | 0.60 | +1 | N-N |
| `prevents` | prevents | `prevented-by` | N | 0.85 | −1 | N-N |
| `prevented-by` | prevented by | `prevents` | N | 0.85 | −1 | N-N |
| `triggers` | triggers | `triggered-by` | N | 0.70 | +1 | N-N |
| `triggered-by` | triggered by | `triggers` | N | 0.70 | +1 | N-N |
| `inhibits` | inhibits | `inhibited-by` | N | 0.55 | −1 | N-N |
| `inhibited-by` | inhibited by | `inhibits` | N | 0.55 | −1 | N-N |

`prevents` (total blockage) and `inhibits` (partial reduction) intentionally differ by strength and remain distinct types — intensity is a semantic property of the type, not a per-edge value.

## Dependency

*What does it need or serve?*

| Type | Label | Inverse | T | S | P | Card |
|------|-------|---------|---|---|---|------|
| `requires` | requires | `required-by` | Y | 0.85 | 0 | N-N |
| `required-by` | required by | `requires` | Y | 0.85 | 0 | N-N |
| `uses` | uses | `used-by` | weak | 0.50 | 0 | N-N |
| `used-by` | used by | `uses` | weak | 0.50 | 0 | N-N |
| `used-for` | used for | `purpose-of` | N | 0.55 | +1 | N-N |
| `purpose-of` | purpose of | `used-for` | N | 0.55 | +1 | N-N |

## Temporal

*When or where does it happen?*

| Type | Label | Inverse | T | S | P | Card |
|------|-------|---------|---|---|---|------|
| `precedes` | precedes | `follows` | Y | 0.50 | 0 | N-N |
| `follows` | follows | `precedes` | Y | 0.50 | 0 | N-N |
| `occurs-in` | occurs in | `has-occurrence` | Y | 0.40 | 0 | N-1 |
| `has-occurrence` | has occurrence | `occurs-in` | Y | 0.40 | 0 | 1-N |

## Opposition

*What does it contrast with?* Symmetric.

| Type | Label | T | S | P | Card |
|------|-------|---|---|---|------|
| `contrasts-with` | contrasts with | N | 0.50 | −1 | N-N |
| `opposite-of` | opposite of | N | 0.80 | −1 | 1-1 |

## Similarity

*What is it like?* Symmetric.

| Type | Label | T | S | P | Card |
|------|-------|---|---|---|------|
| `similar-to` | similar to | weak | 0.40 | +1 | N-N |
| `analogous-to` | analogous to | N | 0.30 | +1 | N-N |

---

**Edge encoding** is controlled per-graph via Settings → Appearance → Edge encoding:

- `full`: glyph and line style
- `category`: colour only
- `minimal`: plain line
