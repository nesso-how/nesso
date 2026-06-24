# Nesso docs site

Starlight + Astro site published at [nesso.how/docs](https://nesso.how/docs).

Content lives under `src/content/docs/`. The sidebar is configured in `astro.config.mjs`. Theme CSS is generated from `@nesso-how/theme` before dev/build (`scripts/gen-theme-css.mjs`).

## Commands

Run from this directory (`docs/`):

| Command        | Action                                      |
| :------------- | :------------------------------------------ |
| `pnpm dev`     | Local dev server (default `localhost:4321`) |
| `pnpm build`   | Production build to `./dist/`               |
| `pnpm preview` | Preview the production build locally        |

From the repo root, use `pnpm --filter docs dev` / `pnpm --filter docs build`.

After editing Markdown under `src/content/docs/`, rebuild `@nesso-how/mcp` from the repo root so the MCP doc bundle stays in sync (`pnpm build:mcp`).
