# Profiling

Maps usually hold tens of concepts, but the graph grows to thousands. Work that scans the whole graph on every edit stays invisible on small documents and becomes noticeable as the graph grows. The benchmarks measure how costs scale with graph size; manual profiling covers what Node cannot run.

Profile before and after changes to store operations, validation, persistence, Graph layout, or other per-edit work, and when a feature adds a scan over the graph.

## Benchmarks

`pnpm perf` builds the packages, generates seeded graphs at several sizes while keeping each map small, and runs every benchmark against the real modules: store operations, persistence, plugin inputs, Graph layout, and map elements. See `pnpm perf --help` for sizes and filters; the graph shape is set in `scripts/perf/generate.ts`. A full run takes a few minutes; use `--filter` and `--sizes` while iterating.

Each cell shows the median time and the interquartile range relative to it. The growth column is the slope of the medians on a log-log scale:

- about 0: cost independent of graph size, expected for work on the active map;
- about 1: linear in graph size, such as a full scan or serialization;
- 2 or more: quadratic or worse, usually a nested scan or repeated lookup that deserves a closer look.

Fixed costs flatten the growth at small sizes. For example, file system syncs dominate saves until the document is large. Compare the growth with what the operation should cost rather than reading it as an absolute score.

Timings depend on the machine and its load. Close other heavy apps, keep the machine on power, and rerun when the spread exceeds 10–15%. Only compare results from the same machine.

### Comparing with a base

`pnpm perf --base origin/main` checks out the base in a temporary worktree, installs its dependencies, runs the current benchmark code against the base sources, and shows each median's change from the base. Differences within the spread are noise; rerun to confirm a change before acting on it. The base must still provide the modules the benchmarks import.

### CPU profiles

`--cpu-prof` writes one `.cpuprofile` per benchmark and size to a temporary folder. Open a profile in the Chrome DevTools Performance panel to see where the time goes. Profiling slows the timings it reports, so measure and profile in separate runs.

## Profiling the app

`pnpm perf app --concepts 5000` builds the production renderer, writes a generated graph to a new temporary data folder, and opens the desktop app on it. Development builds load React in development mode, which distorts profiles, so profile this build rather than `pnpm desktop:dev`.

Open DevTools from View → Toggle Developer Tools, available in every unpackaged build, and record in the Performance or Memory panel while you open the Graph, pan and zoom, edit labels, switch maps, or open Notes and Review.

The data folder is kept after the app closes. Reopen it with `NESSO_USER_DATA=<folder> pnpm desktop`, or delete it. Only unpackaged builds read `NESSO_USER_DATA`; without it, `pnpm desktop` and `pnpm desktop:dev` use `.nesso-dev/` in the checkout.

## Not covered by benchmarks

Benchmarks run in Node and do not cover canvas painting, React rendering, IPC between the renderer and the main process, messages to plugin workers and panels, startup, or memory use. Profile these in the app with generated data.
