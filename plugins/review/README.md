# @nesso-how/review

Isolated action plugin for spaced-repetition practice of a view’s concepts without changing the graph.

## Usage

Open the bundled **Review** action from a view’s actions. The overview includes every concept in that view, with new and due concepts first. Start a round and recall each concept: when it has in-view connections, the prompt lists their relation types and directions with the other concepts hidden, and also asks for an explanation if the concept has notes; otherwise it asks only for an explanation. Reveal its notes and in-view connections, then choose **Again / Hard / Good / Easy**. Space reveals; keys 1–4 rate. Escape or **End session** finishes the round immediately and returns to the overview, keeping completed reviews and leaving remaining concepts available.

The action badge counts new and due concepts in its target view, even with the panel closed. It updates after progress or graph changes and when the next scheduled concept becomes due; zero counts are hidden.

Each round covers its currently due concepts once and returns to the overview. Ratings save progress shared across overlapping views; closing the panel discards only the unfinished round. Progress is private plugin data, excluded from JSON-LD and graph history. Invalid records or failed writes block further ratings until progress is explicitly reloaded, without advancing the round or overwriting saved data.

## API

- `create()`: factory contributing the `review` action with an isolated React panel. Metadata and `storage`/`ui` access declarations live in `package.json`; localized action labels and panel messages live in `src/index.ts` and `src/i18n.ts`.
- `createReview(storage)`: plugin-local scheduler using pinned `ts-fsrs@6.0.0` (FSRS-6, default weights), 90% retention, 1-minute/10-minute learning steps, a 10-minute relearning step, a 36,500-day maximum interval, and no fuzzing.
- `reviewBadge(input)`: readonly count and next refresh time using the same progress validation as the panel, without initializing FSRS.
- Each concept’s first rating creates a concept-associated `progress` record; subsequent ratings atomically update its card and keep only its 20 most recent review log entries. Version 1 records, which kept every entry, are read as version 2 by keeping their latest 20 entries and are rewritten on the concept's next rating. The host owns persistence and retains records after concept deletion; the plugin owns its payload schema and explicit cleanup.

See [src/index.ts](src/index.ts), [src/scheduler.ts](src/scheduler.ts), and the [plugin guide](../../packages/plugin/README.md).
