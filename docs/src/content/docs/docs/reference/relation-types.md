---
title: Relation types
description: The 52 semantic relation types across 8 categories in Nesso.
---

In Nesso, every edge carries a **semantic type**: a named relation describing how two concepts are connected, with type properties reserved for graph-analysis algorithms (future work, no algorithm currently consumes them). The vocabulary is fixed at 52 types across 8 categories, drawn from prior work in knowledge representation, lexical semantics, temporal logic, and signed-network theory.

:::note[About this vocabulary]
These 52 relation types are one slice of `@nesso-how/vocab-learning`, which also defines node parameters (FSRS), display settings, and category palettes. Graph JSON files declare their vocabulary via `vocabulary.id` and `vocabulary.version`; the envelope schema (`@nesso-how/schema`) is vocabulary-agnostic. The types and their property values are a considered first cut, and both will evolve as real graphs accumulate and the analysis algorithms that consume them get built out.
:::

## Properties

Each relation type declares the properties below. They define the contract that graph-analysis algorithms will consume; closing the enum guarantees every type comes with them, where a user-defined type would arrive without and stay analytically opaque.

- **Transitive (T)**: `Y` (strict), `N` (none), or `weak` (transitivity with decay; algorithms may discount per step).
- **Inverse (I)**: the canonical inverse type in the set; `self` for symmetric relations. Asymmetric relations declare it explicitly so traversal is first-class in both directions. The explicit-inverse design follows knowledge-graph embedding work <a id="cite-1" href="#ref-1">[1]</a>, which lists symmetry, antisymmetry, inversion, and composition as the four properties a good relation set should support.
- **Strength (S)**: per-type semantic weight in `0..1`. Encodes how "tight" the relation is in general (e.g. `defines` 0.90 vs `similar-to` 0.40), not how sure the user is about a specific edge. The idea that different relation types carry different semantic distance comes from lexical-taxonomy weighting schemes <a id="cite-2" href="#ref-2">[2]</a>, <a id="cite-3" href="#ref-3">[3]</a>.
- **Polarity (P)**: `+1` positive effect, `-1` antagonistic, `0` neutral/structural. From signed-network theory <a id="cite-4" href="#ref-4">[4]</a>: with polarity, the graph becomes a signed network where balance and cycle-sign analyses can apply.
- **Cardinality (C)**: expected mapping pattern, always declared. One of `1-1`, `1-N`, `N-1`, `N-N` (no a-priori constraint). Setting this consistently lets algorithms flag structural anomalies (e.g. two competing `defines` edges into the same term).

## Visual encoding

- **Visual encoding**: category colour gives a coarse signal across the 8 categories; each type also has a glyph for a finer, near-type-level signal. Edge strokes are solid in every encoding mode.

## Categories

Each category answers a specific question about the relation. Grouping the types by question makes the vocabulary easier to navigate when authoring a graph, and lets graph-analysis algorithms compare and aggregate at category level instead of only per individual type.

### Taxonomic

_What kind of thing is it?_

| Type           | Label        | I              | T   | S    | P   | C   |
| -------------- | ------------ | -------------- | --- | ---- | --- | --- |
| `subtype-of`   | subtype of   | `has-subtype`  | Y   | 0.90 | 0   | N-1 |
| `has-subtype`  | has subtype  | `subtype-of`   | Y   | 0.90 | 0   | 1-N |
| `instance-of`  | instance of  | `has-instance` | N   | 0.95 | 0   | N-1 |
| `has-instance` | has instance | `instance-of`  | N   | 0.95 | 0   | 1-N |

Taxonomic relations answer the simplest question you can ask about a concept: what kind of thing is it? Nesso splits the answer into two layers that look alike at a glance but behave very differently under reasoning. The class-vs-instance distinction mirrors OWL/RDFS <a id="cite-5" href="#ref-5">[5]</a>: `subtype-of` corresponds to `rdfs:subClassOf` (one class refines another, as a sparrow refines bird), while `instance-of` corresponds to `rdf:type` (an individual belongs to a class, as Tweety belongs to sparrow). Inheritance flows freely through the subtype chain, but instances are leaves: Tweety is a sparrow and through that a bird, yet Tweety is not itself "a kind of" anything.

### Structural

_What is it made of or composed from?_

| Type       | Label    | I          | T    | S    | P   | C   |
| ---------- | -------- | ---------- | ---- | ---- | --- | --- |
| `part-of`  | part of  | `contains` | Y    | 0.85 | 0   | N-1 |
| `contains` | contains | `part-of`  | Y    | 0.85 | 0   | 1-N |
| `made-of`  | made of  | `composes` | weak | 0.75 | 0   | N-N |
| `composes` | composes | `made-of`  | weak | 0.75 | 0   | N-N |

Structural relations describe how a thing decomposes into its parts. The category covers two patterns. `part-of` and its inverse `contains` capture discrete structural decomposition: an engine is part of a car, a paragraph is part of a chapter, and transitivity flows cleanly through the chain. `made-of` and `composes` capture material or substantive composition instead: water is made of hydrogen and oxygen, a chair is made of wood. Transitivity there is only weak, because what something is made of doesn't always propagate in a meaningful way (a chair made of wood, made of cellulose, made of carbon, made of atoms dilutes the relationship as the chain grows).

### Causal

_What does it do or prevent?_

| Type           | Label        | I              | T    | S    | P   | C   |
| -------------- | ------------ | -------------- | ---- | ---- | --- | --- |
| `causes`       | causes       | `caused-by`    | N    | 0.85 | +1  | N-N |
| `caused-by`    | caused by    | `causes`       | N    | 0.85 | +1  | N-N |
| `produces`     | produces     | `produced-by`  | N    | 0.70 | +1  | N-N |
| `produced-by`  | produced by  | `produces`     | N    | 0.70 | +1  | N-N |
| `enables`      | enables      | `enabled-by`   | weak | 0.60 | +1  | N-N |
| `enabled-by`   | enabled by   | `enables`      | weak | 0.60 | +1  | N-N |
| `prevents`     | prevents     | `prevented-by` | N    | 0.85 | −1  | N-N |
| `prevented-by` | prevented by | `prevents`     | N    | 0.85 | −1  | N-N |
| `triggers`     | triggers     | `triggered-by` | N    | 0.70 | +1  | N-N |
| `triggered-by` | triggered by | `triggers`     | N    | 0.70 | +1  | N-N |
| `inhibits`     | inhibits     | `inhibited-by` | N    | 0.55 | −1  | N-N |
| `inhibited-by` | inhibited by | `inhibits`     | N    | 0.55 | −1  | N-N |
| `disables`     | disables     | `disabled-by`  | weak | 0.60 | −1  | N-N |
| `disabled-by`  | disabled by  | `disables`     | weak | 0.60 | −1  | N-N |
| `consumes`     | consumes     | `consumed-by`  | N    | 0.65 | −1  | N-N |
| `consumed-by`  | consumed by  | `consumes`     | N    | 0.65 | −1  | N-N |
| `delays`       | delays       | `delayed-by`   | weak | 0.55 | −1  | N-N |
| `delayed-by`   | delayed by   | `delays`       | weak | 0.55 | −1  | N-N |

Causal is the largest category in Nesso, because causation in the real world doesn't come in a single flavor. On the positive side, `causes` describes direct generation of an outcome, `triggers` describes the initiation of something that then plays out on its own (a spark triggers an explosion), and `enables` describes making something possible without forcing it. The negative side mirrors this: `prevents` is total blockage, `inhibits` is partial reduction, and `disables` is switching off a capacity or function. Intensity and mechanism live at the type level rather than as per-edge weights, so choosing between `inhibits` and `prevents` is a semantic decision about what is actually happening, not about how confident the author is.

`consumes` and `delays` round out the category. `consumes` captures resource destruction, which is causal rather than dependency-flavored: it is distinct from `uses`, where the resource survives the interaction. `delays` carries negative polarity because slowing or postponing an outcome hinders it, even though nothing is destroyed.

### Dependency

_What does it need or serve?_

| Type          | Label       | I             | T    | S    | P   | C   |
| ------------- | ----------- | ------------- | ---- | ---- | --- | --- |
| `requires`    | requires    | `required-by` | Y    | 0.85 | 0   | N-N |
| `required-by` | required by | `requires`    | Y    | 0.85 | 0   | N-N |
| `uses`        | uses        | `used-by`     | weak | 0.50 | 0   | N-N |
| `used-by`     | used by     | `uses`        | weak | 0.50 | 0   | N-N |
| `used-for`    | used for    | `purpose-of`  | N    | 0.55 | +1  | N-N |
| `purpose-of`  | purpose of  | `used-for`    | N    | 0.55 | +1  | N-N |

Dependency relations capture what a concept _needs_ rather than what causes it. A car requires an engine to function, but the engine doesn't cause the car, and that difference shows up in how the graph traverses these edges. `requires` and `required-by` are the hard form, where the dependency is essential and transitivity is strict: if A requires B and B requires C, A also requires C. `uses` and `used-by` are softer, capturing a working relationship that doesn't necessarily imply the user can't survive without it, so transitivity decays through the chain. `used-for` and `purpose-of` are teleological: they point at the goal or function a thing serves (a hammer is used for driving nails). Cardinality there stays open at N-N, since one tool can serve many purposes and many tools can share a single purpose.

### Temporal

_When or where does it happen?_

| Type             | Label          | I                | T   | S    | P   | C   |
| ---------------- | -------------- | ---------------- | --- | ---- | --- | --- |
| `precedes`       | precedes       | `follows`        | Y   | 0.50 | 0   | N-N |
| `follows`        | follows        | `precedes`       | Y   | 0.50 | 0   | N-N |
| `occurs-in`      | occurs in      | `has-occurrence` | Y   | 0.40 | 0   | N-1 |
| `has-occurrence` | has occurrence | `occurs-in`      | Y   | 0.40 | 0   | 1-N |
| `during`         | during         | `spans`          | Y   | 0.55 | 0   | N-1 |
| `spans`          | spans          | `during`         | Y   | 0.55 | 0   | 1-N |
| `overlaps-with`  | overlaps with  | self (symmetric) | N   | 0.45 | 0   | N-N |
| `derives-from`   | derives from   | `gives-rise-to`  | Y   | 0.70 | 0   | N-1 |
| `gives-rise-to`  | gives rise to  | `derives-from`   | Y   | 0.70 | 0   | 1-N |

Temporal relations describe when things happen relative to each other and how an event sits inside a larger period. Allen's interval algebra <a id="cite-6" href="#ref-6">[6]</a> inspires the containment pair: `during` and `spans` model intervals nested inside other intervals (the medieval period spans roughly a thousand years, and Charlemagne's reign was during it). `occurs-in` and its inverse work at a different scale, pinning a quasi-point event to the period it falls inside (the moon landing occurs in 1969). `precedes` and `follows` cover plain sequence without nesting, and `overlaps-with` is the symmetric case for two intervals that share a stretch of time without one containing the other.

`derives-from` and `gives-rise-to` are not just about chronology, they capture genealogical descent: a transformative continuity where something becomes something else over time. Languages, species, and ideas all have lineages of this kind. The relation is close to `caused-by` but distinct, because causation is direct influence without requiring the cause to _become_ the effect. It is also distinct from taxonomic `subtype-of`, which is a snapshot of class membership rather than a historical claim. Italian derives from Latin, but Italian is not a subtype of Latin in the modern sense.

### Opposition

_What does it contrast with?_

| Type             | Label          | I                | T   | S    | P   | C   |
| ---------------- | -------------- | ---------------- | --- | ---- | --- | --- |
| `contrasts-with` | contrasts with | self (symmetric) | N   | 0.50 | −1  | N-N |
| `opposite-of`    | opposite of    | self (symmetric) | N   | 0.80 | −1  | 1-1 |

Opposition is the category for concepts that stand against each other. The two types differ in strength. `contrasts-with` is the weaker form, where two concepts highlight each other by sitting at different points on some dimension (warm contrasts with cool, North contrasts with South). `opposite-of` is the canonical, often binary opposite (alive is the opposite of dead, true is the opposite of false), and its cardinality is 1-1 because a canonical opposite is unique. Both are symmetric: if A is the opposite of B, then B is the opposite of A by definition.

### Similarity

_What is it like?_

| Type           | Label        | I                | T    | S    | P   | C   |
| -------------- | ------------ | ---------------- | ---- | ---- | --- | --- |
| `similar-to`   | similar to   | self (symmetric) | weak | 0.40 | +1  | N-N |
| `analogous-to` | analogous to | self (symmetric) | N    | 0.30 | +1  | N-N |

The similarity category includes two related but distinct relations. `similar-to` is the looser one, where two concepts share enough properties to be grouped together (lions are similar to tigers). `analogous-to` is more structural: the two concepts aren't necessarily alike in their properties, but their roles or relationships mirror each other (an electron orbiting an atom is analogous to a planet orbiting the sun). Both are symmetric, and both carry positive polarity because finding similarity or analogy is usually a constructive move in reasoning.

### Epistemic

_How do we know?_

| Type           | Label        | I                | T    | S    | P   | C   |
| -------------- | ------------ | ---------------- | ---- | ---- | --- | --- |
| `supports`     | supports     | `supported-by`   | weak | 0.70 | +1  | N-N |
| `supported-by` | supported by | `supports`       | weak | 0.70 | +1  | N-N |
| `contradicts`  | contradicts  | self (symmetric) | N    | 0.75 | −1  | N-N |
| `explains`     | explains     | `explained-by`   | weak | 0.80 | 0   | N-N |
| `explained-by` | explained by | `explains`       | weak | 0.80 | 0   | N-N |
| `defines`      | defines      | `defined-by`     | N    | 0.90 | 0   | 1-1 |
| `defined-by`   | defined by   | `defines`        | N    | 0.90 | 0   | 1-1 |

The epistemic category is where Nesso models reasoning about claims rather than facts about the world. `supports` and `supported-by` connect a piece of evidence to the claim it bolsters; `explains` and `explained-by` connect an explanans (the explanatory account) to its explanandum (what is being explained). Both pairs are asymmetric, because evidence points to a claim and an explanation is not equivalent to what it explains.

`defines` is the most rigid relation in this category. It goes from the defining expression (the _definiens_) to the term being defined (the _definiendum_): in "F = ma defines force", the equation is the definiens and `force` is the definiendum. Cardinality 1-1 enforces a single canonical definition per term, so two competing `defines` edges into the same concept signal a real ambiguity worth resolving.

`contradicts` is the only symmetric relation in the category, because logical incompatibility goes both ways: if A contradicts B, then B equally contradicts A. This distinguishes it from `supports` and `explains`, which always point in a particular direction.

## References

1. <a id="ref-1"></a>Sun, Z., Deng, Z.-H., Nie, J.-Y., and Tang, J. [_RotatE: Knowledge Graph Embedding by Relational Rotation in Complex Space_](https://arxiv.org/abs/1902.10197). ICLR, 2019. [↑](#cite-1)
2. <a id="ref-2"></a>Sussna, M. [_Word sense disambiguation for free-text indexing using a massive semantic network_](https://doi.org/10.1145/170088.170106). CIKM '93, 1993. [↑](#cite-2)
3. <a id="ref-3"></a>Jiang, J. J. and Conrath, D. W. [_Semantic similarity based on corpus statistics and lexical taxonomy_](https://arxiv.org/abs/cmp-lg/9709008). ROCLING X, 1997. [↑](#cite-3)
4. <a id="ref-4"></a>Cartwright, D. and Harary, F. [_Structural balance: A generalization of Heider's theory_](https://doi.org/10.1037/h0046049). Psychological Review, 63(5):277–293, 1956. [↑](#cite-4)
5. <a id="ref-5"></a>W3C. [_OWL 2 Web Ontology Language Primer (Second Edition)_](https://www.w3.org/TR/owl2-primer/). 2012. [↑](#cite-5)
6. <a id="ref-6"></a>Allen, J. F. [_Maintaining knowledge about temporal intervals_](https://doi.org/10.1145/182.358434). Communications of the ACM, 26(11):832–843, 1983. [↑](#cite-6)
