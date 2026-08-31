---
title: Writing mode
description: A focused writing area over the canvas for a concept's notes, with slash-menu snippets like callouts and examples while the Inspector stays available on the right.
---

Writing Mode is a focused writing area that takes over the **canvas** for a
concept's **notes** while the node **Inspector stays visible docked on the
right**. The Inspector panel is comfortable for a short definition; Writing Mode
is where longer thinking happens.

## Opening and closing

1. Select a concept so the Inspector shows it.
2. Under **Notes**, click **Write**.

The canvas gives way to a centered serif column headed by the concept's name,
with its definition shown read-only underneath as brief context; the Inspector
remains docked on the right the whole time. Press `Esc` or the close button to
exit back to the canvas exactly where you were. If the slash menu is open, the
first `Esc` closes the menu; a second `Esc` then closes Writing Mode.

## Writing

The editor is a rich-text editor: headings, lists, quotes, and dividers work the
way you expect. Type `/` on an empty spot to open the snippet menu:

- **Heading 2 / Heading 3**: structure long notes
- **Bullet list / Numbered list**
- **Quote**
- **Divider**
- **Callout**: a highlighted note box
- **Example**: a worked-example box

Your edits are committed after a short pause and saved with the graph's
autosave. While Writing Mode is open, canvas shortcuts
(including undo on the graph) are suppressed; the editor owns its own undo while
you are inside it. After you close, the app's undo reverts notes in coarser
steps, one per writing pause.

## How notes are stored

Notes are stored with the graph exactly as the editor produces them (IndexedDB
for web graphs, project files on desktop), including custom blocks like callouts
and examples. A concept's elaboration carries a short
`definition` (still editable inline in the Inspector) plus optional `notes`.
Clearing all text from Writing Mode removes the notes entirely instead of
leaving an empty document behind. Graph files that contain blocks a given app
version does not know still load: unknown blocks show as their plain text, so
content is never destroyed. If you edit such a document, those unknown blocks
are kept as their flattened plain text, so their structure is not preserved;
supported blocks like callouts and examples round-trip exactly. This is part
of the graph file compatibility
promise. See [Graph management](../../guides/graph-management/) for the full
picture.
