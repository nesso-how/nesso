---
title: Concepts & Inspector
description: Adding concepts, drawing typed relations, and using the Inspector to enrich nodes with definitions, examples, notes, and images.
---

The canvas is the centre of Nesso. **Concepts** are nodes; **typed relations** are edges. The **Inspector** is the right-hand panel where you enrich whatever you've got selected.

## Adding concepts

- **Bottom dock -> +** adds a new concept near the centre of the viewport.
- **`N`** adds a concept at the viewport centre (same as the dock `+`).
- **Double-click** empty canvas to add a concept at the pointer.
- New concepts open in edit mode. Type the label and press `Enter` to commit, `Esc` to cancel.
- **Double-click** a concept to rename it inline.

Concepts you add are stored locally in IndexedDB. Switch graphs from the sidebar; create new graphs from the **Graphs** list.

## Drawing relations

Drag from a node's right edge (`out` handle) to another node's left edge (`in` handle). On release, a **relation picker** opens, grouped by category. Pick the relation type and the edge is created.

- Drag-to-self is ignored, so you can't accidentally create self-loops.
- The connection line previews with the same quadratic geometry the final edge uses.
- Edge type can be changed any time from the Inspector when an edge is selected.

See the [relation types reference](../../reference/relation-types/) for the full list and what each one encodes visually.

## Selecting and editing

- **Click** a node or edge to select it. The Inspector reflects the selection.
- **Hold `⌘` / `Ctrl` and click** to toggle additional items into the selection.
- **Drag on empty canvas** to marquee-select multiple items.
- **`Del`** or **`Backspace`** (or the trash icon in the bottom dock) deletes the selection — one relation, one concept, or every concept in a marquee. Edges attached to a deleted concept go with it. Relation delete is only from the dock or keyboard, not from the relation Inspector.
- **`⌘C` / `Ctrl+C`** (copy icon in the bottom dock) copies the selection. Copying concepts also copies relations between them; copying a relation includes its two endpoints. **`⌘V` / `Ctrl+V`** (paste icon) duplicates the clipboard with a small offset and selects the new items.
- **Arrow keys** nudge a selected concept; **Shift + arrows** move it in larger steps.
- **`⌘Z` / `Ctrl+Z`** undoes structural edits; **`⌘⇧Z` / `Ctrl+Shift+Z`** redoes. History has 50 steps and resets when you switch or import a graph.

## The Inspector

When a concept is selected, the Inspector shows two tabs.

### Overview

- **Title:** edit inline. Pressing `Enter` commits; `Esc` reverts.
- **FSRS stats:** when due, stability (in days), and last self-rating. Surfaced read-only.
- **Relations:** outgoing and incoming edges grouped by category. Click a relation chip to jump to the connected node; click the type to swap relation in place.

### Notes

Three free-text fields that travel with the concept and feed both the AI mentor and Review:

- **Definition:** a one-sentence-ish explanation in your own words.
- **Examples:** one per line. Press `Shift+Enter` or use the `+` button to add a new line.
- **Notes:** anything else: caveats, sources, mnemonics.

These power the [Review](./review-mode/) recall question. The model is told to _aim_ at the topic suggested by your notes without paraphrasing the definition, so active recall still works.

### Concept image

Press the picture icon to open the **Wikimedia Commons search**. The query auto-fills from the concept title and runs immediately; pick any result to attach a 200-px thumbnail to the concept. The image shows in the Inspector, in Review mode, and is included as context for the AI mentor.

The image link and Commons description URL are persisted with the graph, so attribution is preserved on export.

## When an edge is selected

The Inspector shows the relation as a chip with its category colour and a dropdown of every relation type. Picking a new type updates the edge in place; the graph keeps its endpoints and identity.

When **Display → Curve** is set to **Arc**, an **Flip curve** control mirrors that edge's arc to the opposite side — useful when the default bend overlaps another node or edge. The choice is saved with the graph.

## Stats and search

- **Sidebar -> Stats** shows concept count, link count, and current zoom (a handy gut-check for graph size).
- **`⌘K` / `Ctrl+K`** opens a fuzzy search palette over concept titles. `Enter` selects and recenters the viewport; `Esc` closes.

## Edge encoding density

Edges carry three visual channels: colour (category), line style, and glyph. Crank this down for large or printed graphs from **Settings -> Appearance -> Edge encoding**:

- **Full:** colour + style + glyph (default).
- **Category:** colour only.
- **Minimal:** plain line, no encoding.

Symmetric relations (similarity, opposition) never render an arrowhead regardless of encoding.
