---
title: Relation types
description: The 52 semantic relation types across 8 categories in Nesso.
---

Edges in Nesso carry a **semantic type**: a named relation that describes how two concepts are connected. There are 52 types grouped into 8 categories. Each category has a distinct colour; each type has a line style, a glyph, and a set of semantic coefficients used by graph-analysis algorithms.

Asymmetric relations come in **inverse pairs** (e.g. `subtype-of` / `has-subtype`) so traversal in either direction is first-class. Symmetric relations (`contrasts-with`, `opposite-of`, `similar-to`, `analogous-to`, `overlaps-with`, `contradicts`) are self-inverse.

## Coefficients

Each relation type declares:

- **`symmetric`** — `true` when the edge carries the same meaning in both directions (no arrowhead).
- **`transitive`** — `Y` (strict), `N` (none), or `weak` (transitivity with decay; algorithms may discount per step).
- **`inverse`** — the canonical inverse type in the set. Self for symmetric relations.
- **`strength`** — per-type semantic weight in `0..1`. Encodes how "tight" the relation is, not per-edge confidence.
- **`polarity`** — `+1` positive effect, `-1` antagonistic, `0` neutral/structural. From signed-network theory.
- **`cardinality`** — expected mapping pattern: `1-1`, `1-N`, `N-1`, or `N-N` (no constraint).

## Taxonomic

_What kind of thing is it?_

| Type           | Label        | Inverse        | T   | S    | P   | Card |
| -------------- | ------------ | -------------- | --- | ---- | --- | ---- |
| `subtype-of`   | subtype of   | `has-subtype`  | Y   | 0.90 | 0   | N-1  |
| `has-subtype`  | has subtype  | `subtype-of`   | Y   | 0.90 | 0   | 1-N  |
| `instance-of`  | instance of  | `has-instance` | N   | 0.95 | 0   | N-1  |
| `has-instance` | has instance | `instance-of`  | N   | 0.95 | 0   | 1-N  |

## Structural

_What is it made of or composed from?_

| Type       | Label    | Inverse    | T    | S    | P   | Card |
| ---------- | -------- | ---------- | ---- | ---- | --- | ---- |
| `part-of`  | part of  | `contains` | Y    | 0.85 | 0   | N-1  |
| `contains` | contains | `part-of`  | Y    | 0.85 | 0   | 1-N  |
| `made-of`  | made of  | `composes` | weak | 0.75 | 0   | N-N  |
| `composes` | composes | `made-of`  | weak | 0.75 | 0   | N-N  |

## Causal

_What does it do or prevent?_

| Type           | Label        | Inverse        | T    | S    | P   | Card |
| -------------- | ------------ | -------------- | ---- | ---- | --- | ---- |
| `causes`       | causes       | `caused-by`    | N    | 0.85 | +1  | N-N  |
| `caused-by`    | caused by    | `causes`       | N    | 0.85 | +1  | N-N  |
| `produces`     | produces     | `produced-by`  | N    | 0.70 | +1  | N-N  |
| `produced-by`  | produced by  | `produces`     | N    | 0.70 | +1  | N-N  |
| `enables`      | enables      | `enabled-by`   | weak | 0.60 | +1  | N-N  |
| `enabled-by`   | enabled by   | `enables`      | weak | 0.60 | +1  | N-N  |
| `prevents`     | prevents     | `prevented-by` | N    | 0.85 | −1  | N-N  |
| `prevented-by` | prevented by | `prevents`     | N    | 0.85 | −1  | N-N  |
| `triggers`     | triggers     | `triggered-by` | N    | 0.70 | +1  | N-N  |
| `triggered-by` | triggered by | `triggers`     | N    | 0.70 | +1  | N-N  |
| `inhibits`     | inhibits     | `inhibited-by` | N    | 0.55 | −1  | N-N  |
| `inhibited-by` | inhibited by | `inhibits`     | N    | 0.55 | −1  | N-N  |
| `disables`     | disables     | `disabled-by`  | weak | 0.60 | −1  | N-N  |
| `disabled-by`  | disabled by  | `disables`     | weak | 0.60 | −1  | N-N  |
| `consumes`     | consumes     | `consumed-by`  | N    | 0.65 | −1  | N-N  |
| `consumed-by`  | consumed by  | `consumes`     | N    | 0.65 | −1  | N-N  |
| `delays`       | delays       | `delayed-by`   | weak | 0.55 | −1  | N-N  |
| `delayed-by`   | delayed by   | `delays`       | weak | 0.55 | −1  | N-N  |

`prevents` (total blockage), `inhibits` (partial reduction), and `disables` (switches off a capacity or function) are three distinct negative types — intensity and mechanism are semantic properties of the type, not a per-edge value. `disables` is the counterpart to `enables`; use `prevents` when an outcome is fully blocked and `inhibits` when it is only reduced.

The category also includes `consumes` (resource destruction, distinct from dependency's `uses`) and `delays` (slows or postpones an effect; polarity −1 because delay hinders the outcome).

## Dependency

_What does it need or serve?_

| Type          | Label       | Inverse       | T    | S    | P   | Card |
| ------------- | ----------- | ------------- | ---- | ---- | --- | ---- |
| `requires`    | requires    | `required-by` | Y    | 0.85 | 0   | N-N  |
| `required-by` | required by | `requires`    | Y    | 0.85 | 0   | N-N  |
| `uses`        | uses        | `used-by`     | weak | 0.50 | 0   | N-N  |
| `used-by`     | used by     | `uses`        | weak | 0.50 | 0   | N-N  |
| `used-for`    | used for    | `purpose-of`  | N    | 0.55 | +1  | N-N  |
| `purpose-of`  | purpose of  | `used-for`    | N    | 0.55 | +1  | N-N  |

## Temporal

_When or where does it happen?_

| Type             | Label          | Inverse          | T   | S    | P   | Card |
| ---------------- | -------------- | ---------------- | --- | ---- | --- | ---- |
| `precedes`       | precedes       | `follows`        | Y   | 0.50 | 0   | N-N  |
| `follows`        | follows        | `precedes`       | Y   | 0.50 | 0   | N-N  |
| `occurs-in`      | occurs in      | `has-occurrence` | Y   | 0.40 | 0   | N-1  |
| `has-occurrence` | has occurrence | `occurs-in`      | Y   | 0.40 | 0   | 1-N  |
| `during`         | during         | `spans`          | Y   | 0.55 | 0   | N-1  |
| `spans`          | spans          | `during`         | Y   | 0.55 | 0   | 1-N  |
| `overlaps-with`  | overlaps with  | self (symmetric) | N   | 0.45 | 0   | N-N  |
| `derives-from`   | derives from   | `gives-rise-to`  | Y   | 0.70 | 0   | N-1  |
| `gives-rise-to`  | gives rise to  | `derives-from`   | Y   | 0.70 | 0   | 1-N  |

`during` / `spans` model Allen's interval-in-interval containment (peer intervals). Distinct from `occurs-in` which localizes a quasi-point event in a period (different scale).

`derives-from` / `gives-rise-to` capture genealogical descent — temporal lineage with transformative continuity (languages, species, ideas), distinct from `caused-by` (direct influence without continuity) and from taxonomic `subtype-of` (class membership at a snapshot in time, not historical descent).

## Opposition

_What does it contrast with?_ Symmetric.

| Type             | Label          | T   | S    | P   | Card |
| ---------------- | -------------- | --- | ---- | --- | ---- |
| `contrasts-with` | contrasts with | N   | 0.50 | −1  | N-N  |
| `opposite-of`    | opposite of    | N   | 0.80 | −1  | 1-1  |

## Similarity

_What is it like?_ Symmetric.

| Type           | Label        | T    | S    | P   | Card |
| -------------- | ------------ | ---- | ---- | --- | ---- |
| `similar-to`   | similar to   | weak | 0.40 | +1  | N-N  |
| `analogous-to` | analogous to | N    | 0.30 | +1  | N-N  |

## Epistemic

_How do we know?_

| Type           | Label        | Inverse          | T    | S    | P   | Card |
| -------------- | ------------ | ---------------- | ---- | ---- | --- | ---- |
| `supports`     | supports     | `supported-by`   | weak | 0.70 | +1  | N-N  |
| `supported-by` | supported by | `supports`       | weak | 0.70 | +1  | N-N  |
| `contradicts`  | contradicts  | self (symmetric) | N    | 0.75 | −1  | N-N  |
| `explains`     | explains     | `explained-by`   | weak | 0.80 | 0   | N-N  |
| `explained-by` | explained by | `explains`       | weak | 0.80 | 0   | N-N  |
| `defines`      | defines      | `defined-by`     | N    | 0.90 | 0   | 1-1  |
| `defined-by`   | defined by   | `defines`        | N    | 0.90 | 0   | 1-1  |

`defines` goes from the defining expression (definiens) to the term being defined (definiendum) — e.g. "F = ma defines force". Cardinality 1-1 enforces one canonical definition per term.

`contradicts` is symmetric (mutual logical incompatibility), unlike `supports` and `explains` which are asymmetric evidence/explanans → claim relations.

---

**Edge encoding** is controlled per-graph via Settings → Appearance → Edge encoding:

- `full`: glyph and line style
- `category`: colour only
- `minimal`: plain line
