# @nesso-how/review

An isolated action plugin for spaced-repetition practice of a map’s concepts. It leaves the graph unchanged.

## Usage

See [Review in the map actions reference](../../docs/guide.md#review) for recall prompts, ratings, and keyboard shortcuts.

## API

- `create()`: factory contributing the `review` action with an isolated React panel. Metadata and `storage`/`ui` access declarations live in `package.json`, while localized action labels and panel messages live in `src/index.ts` and `src/i18n.ts`.
- `createReview(storage)`: plugin-local scheduler using pinned `ts-fsrs@6.0.0` (FSRS-6 with default weights), 90% retention, learning steps of 1 minute and 10 minutes, a 10-minute relearning step, a maximum interval of 36,500 days, and no fuzzing.
- `reviewBadge(input)`: returns a readonly count and the next refresh time, using the same progress validation as the panel without initializing FSRS.
- A concept’s first rating creates a `progress` record associated with that concept, and later ratings update its card atomically while keeping only the 20 most recent review log entries. Version 1 records, which kept every entry, are read as version 2 with their latest 20 entries and rewritten on the concept's next rating. The host owns persistence and keeps records after a concept is deleted, while the plugin owns its payload schema and is responsible for cleaning up its records.

See [src/index.ts](src/index.ts), [src/scheduler.ts](src/scheduler.ts), and the [plugin guide](../../packages/plugin/README.md).
