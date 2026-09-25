---
title: Relation types
description: The 52 semantic relation types across 8 categories in Nesso.
---

In Nesso, every edge carries a **semantic type**: a named relation describing how two concepts are connected. The vocabulary is fixed at 52 types across 8 categories, drawn from prior work in knowledge representation, lexical semantics, and temporal logic.

:::note[About this vocabulary]
These 52 relation types are one slice of `@nesso-how/vocab-learning`, which also defines node parameters (FSRS), display settings, and category palettes. Graph JSON files declare their vocabulary via `vocabulary.id` and `vocabulary.version`; the envelope schema (`@nesso-how/schema`) is vocabulary-agnostic. The set is a considered first cut and will evolve as real graphs accumulate.
:::

Each type declares its category, its label, and its canonical inverse (`self` for symmetric relations). Asymmetric relations declare the inverse explicitly so traversal is first-class in both directions. The explicit-inverse design follows knowledge-graph embedding work <a id="cite-1" href="#ref-1">[1]</a>, which lists symmetry, antisymmetry, inversion, and composition as the four properties a good relation set should support.

## Visual encoding

- **Visual encoding**: category colour is the single visual channel, giving a coarse signal across the 8 categories; the relation label names the exact type on hover, selection, or in `full` edge encoding. Edge strokes are solid in every encoding mode.

## Categories

Each category answers a specific question about the relation. Grouping the types by question makes the vocabulary easier to navigate when authoring a graph.

### Taxonomic

_What kind of thing is it?_

| Type           | Label        | I              |
| -------------- | ------------ | -------------- |
| `subtype-of`   | subtype of   | `has-subtype`  |
| `has-subtype`  | has subtype  | `subtype-of`   |
| `instance-of`  | instance of  | `has-instance` |
| `has-instance` | has instance | `instance-of`  |

Taxonomic relations answer the simplest question you can ask about a concept: what kind of thing is it? Nesso splits the answer into two layers that look alike at a glance but behave very differently under reasoning. The class-vs-instance distinction mirrors OWL/RDFS <a id="cite-2" href="#ref-2">[2]</a>: `subtype-of` corresponds to `rdfs:subClassOf` (one class refines another, as a sparrow refines bird), while `instance-of` corresponds to `rdf:type` (an individual belongs to a class, as Tweety belongs to sparrow). Inheritance flows freely through the subtype chain, but instances are leaves: Tweety is a sparrow and through that a bird, yet Tweety is not itself "a kind of" anything.

### Structural

_What is it made of or composed from?_

| Type       | Label    | I          |
| ---------- | -------- | ---------- |
| `part-of`  | part of  | `contains` |
| `contains` | contains | `part-of`  |
| `made-of`  | made of  | `composes` |
| `composes` | composes | `made-of`  |

Structural relations describe how a thing decomposes into its parts. The category covers two patterns. `part-of` and its inverse `contains` capture discrete structural decomposition: an engine is part of a car, a paragraph is part of a chapter, and the relation chains cleanly. `made-of` and `composes` capture material or substantive composition instead: water is made of hydrogen and oxygen, a chair is made of wood. That link dilutes along long chains, because what something is made of doesn't always propagate in a meaningful way (a chair made of wood, made of cellulose, made of carbon, made of atoms).

### Causal

_What does it do or prevent?_

| Type           | Label        | I              |
| -------------- | ------------ | -------------- |
| `causes`       | causes       | `caused-by`    |
| `caused-by`    | caused by    | `causes`       |
| `produces`     | produces     | `produced-by`  |
| `produced-by`  | produced by  | `produces`     |
| `enables`      | enables      | `enabled-by`   |
| `enabled-by`   | enabled by   | `enables`      |
| `prevents`     | prevents     | `prevented-by` |
| `prevented-by` | prevented by | `prevents`     |
| `triggers`     | triggers     | `triggered-by` |
| `triggered-by` | triggered by | `triggers`     |
| `inhibits`     | inhibits     | `inhibited-by` |
| `inhibited-by` | inhibited by | `inhibits`     |
| `disables`     | disables     | `disabled-by`  |
| `disabled-by`  | disabled by  | `disables`     |
| `consumes`     | consumes     | `consumed-by`  |
| `consumed-by`  | consumed by  | `consumes`     |
| `delays`       | delays       | `delayed-by`   |
| `delayed-by`   | delayed by   | `delays`       |

Causal is the largest category in Nesso, because causation in the real world doesn't come in a single flavor. On the positive side, `causes` describes direct generation of an outcome, `triggers` describes the initiation of something that then plays out on its own (a spark triggers an explosion), and `enables` describes making something possible without forcing it. The negative side mirrors this: `prevents` is total blockage, `inhibits` is partial reduction, and `disables` is switching off a capacity or function. Choosing between `inhibits` and `prevents` is a semantic decision about what is actually happening, not about how confident the author is.

`consumes` and `delays` round out the category. `consumes` captures resource destruction, which is causal rather than dependency-flavored: it is distinct from `uses`, where the resource survives the interaction. `delays` slows or postpones an outcome, even though nothing is destroyed.

### Dependency

_What does it need or serve?_

| Type          | Label       | I             |
| ------------- | ----------- | ------------- |
| `requires`    | requires    | `required-by` |
| `required-by` | required by | `requires`    |
| `uses`        | uses        | `used-by`     |
| `used-by`     | used by     | `uses`        |
| `used-for`    | used for    | `purpose-of`  |
| `purpose-of`  | purpose of  | `used-for`    |

Dependency relations capture what a concept _needs_ rather than what causes it. A car requires an engine to function, but the engine doesn't cause the car, and that difference shows up in how the graph traverses these edges. `requires` and `required-by` are the hard form, where the dependency is essential: if A requires B and B requires C, A also requires C. `uses` and `used-by` are softer, capturing a working relationship that doesn't necessarily imply the user can't survive without it. `used-for` and `purpose-of` are teleological: they point at the goal or function a thing serves (a hammer is used for driving nails). One tool can serve many purposes and many tools can share a single purpose.

### Temporal

_When or where does it happen?_

| Type             | Label          | I                |
| ---------------- | -------------- | ---------------- |
| `precedes`       | precedes       | `follows`        |
| `follows`        | follows        | `precedes`       |
| `occurs-in`      | occurs in      | `has-occurrence` |
| `has-occurrence` | has occurrence | `occurs-in`      |
| `during`         | during         | `spans`          |
| `spans`          | spans          | `during`         |
| `overlaps-with`  | overlaps with  | self (symmetric) |
| `derives-from`   | derives from   | `gives-rise-to`  |
| `gives-rise-to`  | gives rise to  | `derives-from`   |

Temporal relations describe when things happen relative to each other and how an event sits inside a larger period. Allen's interval algebra <a id="cite-3" href="#ref-3">[3]</a> inspires the containment pair: `during` and `spans` model intervals nested inside other intervals (the medieval period spans roughly a thousand years, and Charlemagne's reign was during it). `occurs-in` and its inverse work at a different scale, pinning a quasi-point event to the period it falls inside (the moon landing occurs in 1969). `precedes` and `follows` cover plain sequence without nesting, and `overlaps-with` is the symmetric case for two intervals that share a stretch of time without one containing the other.

`derives-from` and `gives-rise-to` are not just about chronology, they capture genealogical descent: a transformative continuity where something becomes something else over time. Languages, species, and ideas all have lineages of this kind. The relation is close to `caused-by` but distinct, because causation is direct influence without requiring the cause to _become_ the effect. It is also distinct from taxonomic `subtype-of`, which is a snapshot of class membership rather than a historical claim. Italian derives from Latin, but Italian is not a subtype of Latin in the modern sense.

### Opposition

_What does it contrast with?_

| Type             | Label          | I                |
| ---------------- | -------------- | ---------------- |
| `contrasts-with` | contrasts with | self (symmetric) |
| `opposite-of`    | opposite of    | self (symmetric) |

Opposition is the category for concepts that stand against each other. The two types differ in strictness. `contrasts-with` is the weaker form, where two concepts highlight each other by sitting at different points on some dimension (warm contrasts with cool, North contrasts with South). `opposite-of` is the canonical, often binary opposite (alive is the opposite of dead, true is the opposite of false), and a canonical opposite is unique. Both are symmetric: if A is the opposite of B, then B is the opposite of A by definition.

### Similarity

_What is it like?_

| Type           | Label        | I                |
| -------------- | ------------ | ---------------- |
| `similar-to`   | similar to   | self (symmetric) |
| `analogous-to` | analogous to | self (symmetric) |

The similarity category includes two related but distinct relations. `similar-to` is the looser one, where two concepts share enough properties to be grouped together (lions are similar to tigers). `analogous-to` is more structural: the two concepts aren't necessarily alike in their properties, but their roles or relationships mirror each other (an electron orbiting an atom is analogous to a planet orbiting the sun). Both are symmetric.

### Epistemic

_How do we know?_

| Type           | Label        | I                |
| -------------- | ------------ | ---------------- |
| `supports`     | supports     | `supported-by`   |
| `supported-by` | supported by | `supports`       |
| `contradicts`  | contradicts  | self (symmetric) |
| `explains`     | explains     | `explained-by`   |
| `explained-by` | explained by | `explains`       |
| `defines`      | defines      | `defined-by`     |
| `defined-by`   | defined by   | `defines`        |

The epistemic category is where Nesso models reasoning about claims rather than facts about the world. `supports` and `supported-by` connect a piece of evidence to the claim it bolsters; `explains` and `explained-by` connect an explanans (the explanatory account) to its explanandum (what is being explained). Both pairs are asymmetric, because evidence points to a claim and an explanation is not equivalent to what it explains.

`defines` is the most rigid relation in this category. It goes from the defining expression (the _definiens_) to the term being defined (the _definiendum_): in "F = ma defines force", the equation is the definiens and `force` is the definiendum. There is a single canonical definition per term, so two competing `defines` edges into the same concept signal a real ambiguity worth resolving.

`contradicts` is the only symmetric relation in the category, because logical incompatibility goes both ways: if A contradicts B, then B equally contradicts A. This distinguishes it from `supports` and `explains`, which always point in a particular direction.

## References

1. <a id="ref-1"></a>Sun, Z., Deng, Z.-H., Nie, J.-Y., and Tang, J. [_RotatE: Knowledge Graph Embedding by Relational Rotation in Complex Space_](https://arxiv.org/abs/1902.10197). ICLR, 2019. [↑](#cite-1)
2. <a id="ref-2"></a>W3C. [_OWL 2 Web Ontology Language Primer (Second Edition)_](https://www.w3.org/TR/owl2-primer/). 2012. [↑](#cite-2)
3. <a id="ref-3"></a>Allen, J. F. [_Maintaining knowledge about temporal intervals_](https://doi.org/10.1145/182.358434). Communications of the ACM, 26(11):832–843, 1983. [↑](#cite-3)
