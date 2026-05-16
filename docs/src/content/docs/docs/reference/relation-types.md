---
title: Relation types
description: The 21 semantic relation types across 7 categories in Nesso.
---

Edges in Nesso carry a **semantic type**: a named relation that describes how two concepts are connected. There are 21 types grouped into 7 categories. Each category has a distinct colour; each type has a line style and a glyph.

## Taxonomic

*What kind of thing is it?*

| Type | Label | Line | Glyph |
|------|-------|------|-------|
| `is-a` | is a | solid | triangle-up |
| `instance-of` | instance of | solid | circle-dot |
| `subtype-of` | subtype of | double | triangle-up |

## Structural

*What is it made of or composed from?*

| Type | Label | Line | Glyph |
|------|-------|------|-------|
| `part-of` | part of | solid | diamond |
| `made-of` | made of | dashed | hash |
| `contains` | contains | solid | diamond-open |

## Causal

*What does it do or prevent?*

| Type | Label | Line | Glyph |
|------|-------|------|-------|
| `causes` | causes | solid | arrow-right |
| `produces` | produces | solid | asterisk |
| `enables` | enables | dotted | key |
| `prevents` | prevents | dotted | block |
| `triggers` | triggers | solid | spark |
| `inhibits` | inhibits | dotted | minus |

## Dependency

*What does it need or serve?*

| Type | Label | Line | Glyph |
|------|-------|------|-------|
| `requires` | requires | solid | anchor |
| `uses` | uses | dashed | tool |
| `used-for` | used for | dashed | flag |

## Temporal

*When or where does it happen?*

| Type | Label | Line | Glyph |
|------|-------|------|-------|
| `precedes` | precedes | solid | chevron-r |
| `occurs-in` | occurs in | dotted | ring |

## Opposition

*What does it contrast with?* Symmetric.

| Type | Label | Line | Glyph |
|------|-------|------|-------|
| `contrasts-with` | contrasts with | wavy | tilde |
| `opposite-of` | opposite of | double | x |

## Similarity

*What is it like?* Symmetric.

| Type | Label | Line | Glyph |
|------|-------|------|-------|
| `similar-to` | similar to | dashed | approx |
| `analogous-to` | analogous to | dotted | arrows-lr |

---

**Symmetric** relations (opposition and similarity) carry the same meaning in both directions; the edge has no arrowhead.

**Edge encoding** is controlled per-graph via Settings -> Appearance -> Edge encoding:
- `full`: glyph and line style
- `category`: colour only
- `minimal`: plain line
