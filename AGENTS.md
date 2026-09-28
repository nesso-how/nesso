# Nesso-min

- Keep this a minimal, light-only knowledge graph app. Prefer removing complexity over adding abstractions.
- Maintain one global graph in the Zustand store. The canvas shows the focused concept and its direct neighbors through incoming or outgoing edges; selecting an item does not change focus.
- Concepts are nodes with tags as metadata. Relations are directed edges with optional free-text labels, not a fixed vocabulary. New concepts are linked to the focus by an unlabeled edge.
- The Explorer groups concepts by tag (including Untagged); multiple selected tags filter with AND. Edit the selected item in the Inspector, or the focused concept when nothing is selected.
- Keep edits in memory; `data/sample-graph.json` is the starting graph.
- Write UI, code, comments, and documentation in English.
- Check changes with `pnpm build` and `pnpm lint`. Stage changes for review, and do not commit until the user has reviewed the diff and explicitly approves.
