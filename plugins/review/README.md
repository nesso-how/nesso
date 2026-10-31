# @nesso-how/review

Isolated action plugin for spaced-repetition practice of a view’s concepts without changing the graph.

## Usage

Open the bundled **Review** action from a view’s actions. The overview includes every concept in that view, with new and due concepts first. Start a round, recall each concept, reveal its notes and in-view connections, then choose **Again / Hard / Good / Easy**. Space reveals; keys 1–4 rate. Escape or **End session** finishes the round immediately and returns to the overview, keeping completed reviews and leaving remaining concepts available.

Each round covers its currently due concepts once and returns to the overview. Ratings save progress shared across overlapping views; closing the panel discards only the unfinished round. Progress is private plugin data, excluded from JSON-LD and graph history. Invalid records or failed writes block further ratings until progress is explicitly reloaded, without advancing the round or overwriting saved data.

## API

- `create()`: factory contributing the `review-view` action with an isolated React panel. Metadata and `storage`/`ui` access declarations live in `package.json`; localized action labels and panel messages live in `src/index.ts` and `src/i18n.ts`.
- `createReview(storage)`: plugin-local scheduler using pinned `ts-fsrs@6.0.0` (FSRS-6, default weights), 90% retention, 1-minute/10-minute learning steps, a 10-minute relearning step, a 36,500-day maximum interval, and no fuzzing.
- Each concept’s first rating creates a concept-associated `progress` record; subsequent ratings atomically update its card and review log. The host owns persistence and orphan cleanup.

See [src/index.ts](src/index.ts), [src/scheduler.ts](src/scheduler.ts), and the [plugin guide](../../packages/plugin/README.md).
