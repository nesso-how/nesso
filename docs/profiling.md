# Profiling

Maps usually hold tens of concepts, but the graph grows to thousands. Work that scans the whole graph on every edit goes unnoticed on small documents but slows editing as the graph grows. The benchmarks measure how costs scale with graph size, and manual profiling covers what Node cannot run.

Profile before and after you change store operations, validation, persistence, Graph layout, or other per-edit work, and whenever a feature adds a scan over the graph.

## Benchmarks

`pnpm perf` builds the packages and generates seeded graphs at several sizes, keeping each map small. It then runs every benchmark against the real modules: store operations, persistence, plugin inputs, Graph layout, and map elements. Run `pnpm perf --help` for sizes and filters, and see `scripts/perf/generate.ts` for the graph shape. A full run takes a few minutes, so use `--filter` and `--sizes` while iterating.

Each cell shows the median time and the interquartile range relative to that median. The growth column is the slope of the medians on a log-log scale.

- About 0 means the cost doesn't depend on graph size, as expected for work on the active map.
- About 1 means the cost is linear in graph size, as with a full scan or serialization.
- 2 or more means quadratic or worse, which usually points to a nested scan or repeated lookup that deserves a closer look.

Fixed costs flatten the growth at small sizes, as when file system syncs dominate saves until the document is large. The growth is not an absolute score, so compare it with what the operation should cost.

Timings depend on the machine and its load, so compare only results from the same machine. Close other heavy apps, keep the machine on power, and rerun when the spread exceeds 10–15%.

### Comparing with a base

`pnpm perf --base origin/main` checks out the base in a temporary worktree, installs its dependencies, and runs the current benchmark code against the base sources, so the base must still provide the modules the benchmarks import. The results show how each median changed from the base. Differences within the spread are noise, so rerun to confirm a change before you act on it.

### CPU profiles

`--cpu-prof` writes one `.cpuprofile` per benchmark and size to a temporary folder, and you can open each profile in the Chrome DevTools Performance panel to see where the time goes. Profiling slows the timings it reports, so measure and profile in separate runs.

## Profiling the app

`pnpm perf app --concepts 5000` builds the production renderer, writes a generated graph to a new temporary data folder, and opens the desktop app on that folder. Profile this build instead of `pnpm desktop:dev`, because development builds load React in development mode, which distorts profiles.

Open DevTools from View → Toggle Developer Tools, which every unpackaged build offers. Record in the Performance or Memory panel while you open the Graph, pan and zoom, edit labels, switch maps, or open Notes and Review.

The data folder stays after the app closes, so you can reopen it with `NESSO_USER_DATA=<folder> pnpm desktop` or delete it. Only unpackaged builds read `NESSO_USER_DATA`, and without it, `pnpm desktop` and `pnpm desktop:dev` use `.nesso-dev/` in the checkout.

## Not covered by benchmarks

Benchmarks run in Node, so they don't cover canvas painting, React rendering, IPC between the renderer and the main process, messages to plugin workers and panels, startup, or memory use. Profile these in the app with generated data.
