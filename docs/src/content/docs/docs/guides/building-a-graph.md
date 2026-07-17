---
title: Building a graph
description: How to add concepts, draw typed relations, and use the Inspector to enrich nodes with definitions.
---

The canvas is the centre of Nesso. **Concepts** are nodes and **typed relations** are edges. The **Inspector** is the right-hand panel where you enrich whatever you've got selected.

## Adding concepts

- **Double-click** empty canvas to add a concept at the pointer.
- **`N`** adds a concept at the viewport centre.
- **Right-click** empty canvas and choose **Add concept here** to add one at the cursor.
- New concepts open in edit mode with the text input focused. Start typing immediately. Press `Enter` to commit, `Esc` to cancel.
- **Double-click** a concept to rename it inline.

An empty graph shows a centered **"Your first concept"** hint, but the double-click still works through it.

## Drawing relations

Drag from either visible connection dot on a node to another node. The node where you start is the source and the node where you release is the target, so the relation picker follows the direction of your gesture. The usual path is the right edge (`out`) to the other node's left edge (`in`). On release, a **relation picker** opens, grouped by category. Pick the relation type and the edge is created.

- The connection line previews with the same quadratic geometry the final edge uses.
- Edge type can be changed any time from the Inspector when an edge is selected.

See the [relation types reference](../../reference/relation-types/) for the full list, semantic meaning, and type properties. Each type has a category colour and an SVG glyph, both defined in `@nesso-how/vocab-learning`. Edge encoding density is under [Display options](#display-options-sidebar) below.

## Selecting and editing

- **Click** a node or edge to select it. The Inspector reflects the selection.
- **Hold `⌘` / `Ctrl` and click** to toggle additional items into the selection.
- **Drag on empty canvas** to marquee-select multiple items.
- **`⌘A` / `Ctrl+A`** selects every concept and relation in the graph.
- **Right-click** a concept, relation, or empty canvas for a context menu of the relevant actions (copy/cut/duplicate/delete a concept; flip / delete a relation; paste / add concept / center·fit on the canvas). To change a relation's type, select the edge and pick a new type in the Inspector.
- **`Del`** or **`Backspace`** deletes the selection (one relation, one concept, or every concept in a marquee). Edges attached to a deleted concept go with it. Delete is also on the right-click menu and the Inspector's action toolbar.
- **`⌘C` / `Ctrl+C`** copies the selection. Copying concepts also copies relations between them; copying a relation includes its two endpoints. **`⌘X` / `Ctrl+X`** cuts: it copies the selection and removes it in one step. **`⌘V` / `Ctrl+V`** pastes the clipboard with a small offset (right-click **Paste** drops it at the cursor instead). **`⌘D` / `Ctrl+D`** duplicates the selection in place without touching the clipboard. These also live on the right-click menu and the Inspector toolbar.
- **Arrow keys** nudge a selected concept, and **Shift + arrows** move it in larger steps.
- **`⌘Z` / `Ctrl+Z`** undoes structural edits; **`⌘⇧Z` / `Ctrl+Shift+Z`** redoes. History has 50 steps and resets when you switch or import a graph.

## The Inspector

The Inspector docks on the **right**, full height between the top bar and the status bar. Its header has a **collapse** control that shrinks it to a slim **rail** (keeping the selection plus a vertical action toolbar) and a **close** control. A docked bottom **action toolbar** offers copy / cut / duplicate / delete for a concept, or flip / delete for a relation.

When a concept is selected it shows, top to bottom:

- **Memory** _(collapsible):_ the FSRS schedule, read-only: when due, stability (in days), last self-rating, review count (with lapses), and time since the last review.
- **Definition**: see below.
- **Relations** _(collapsible):_ outgoing and incoming edges, each connected concept shown with the relation glyph in a chip and the type on the right (incoming dimmed). Click a row to jump to that concept. Change a relation's type by selecting the edge.

When an edge is selected, the Inspector shows the relation as a chip with its category colour and a dropdown of every relation type. Picking a new type updates the edge in place. The graph keeps its endpoints and identity.

### Definition field

A single free-text field that travels with the concept and feeds both the AI mentor and [Review](../../guides/review-mode/):

- **Definition:** a one-sentence-ish explanation in your own words.

In Review, the definition appears when you **Reveal** a card so you can check your recall. The AI mentor uses the definition in its graph snapshot and focal-neighbour context when a concept is selected.

## Display options (sidebar)

**Sidebar → Display** controls how the **active graph** is rendered: heatmap overlay, edge encoding density, curve style, and auto flip. Choices are saved **with the graph** in IndexedDB (and included in JSON export). New graphs start from the app defaults until you change them.

When **Display → Curve** is set to **Arc**, **Auto flip** (on by default) bends relations toward the side that avoids overlapping nodes, flipping when the target is above the source on the right, or below on the left, and updates live while you drag concepts. **Flip curve** in the Inspector is **Off | Auto | On** while auto flip is on: **Auto** follows layout, **Off** / **On** pin a manual bend on that edge. With auto flip off for that graph, the control is **Off | On** only.
