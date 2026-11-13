# Changelog

## 1.0.0-beta.17 — 2026-11-13

### Documentation

- **site:** Refresh page titles and descriptions for search

### Features

- **site:** Declare site name for search and social previews

### Fixes

- **plugins:** Retain incompatible plugin records without blocking (#332)
- **notes:** Keep concept undo local while editing (#333)
- **ai:** Version persisted connection records (#329)
- **plugins:** Version installed plugin records (#330)
- **storage:** Version data location configuration (#331)
- **import:** Preserve graph-only files without creating views (#334)

## 1.0.0-beta.16 — 2026-11-12

### Breaking Changes

- **views:** Move concept presentation into saved views (#316)
  move concept presentation into saved views (#316)

### Features

- **views:** Bring existing concepts into a view (#317)
- **views:** Add an overview renderer for the whole graph (#319)

### Fixes

- **review:** Localize relation labels (#325)

## 1.0.0-beta.15 — 2026-11-11

### Documentation

- **agents:** Fetch and start from origin/main before work
- **site:** Explain plugin isolation in the plugins section
- **readme:** Add faq on data, sync, ai and plugins

### Features

- **chat:** Add copy, retry and response stats (#305)
- **plugins:** Render declared access as chips and capability rows (#307)
- **graph:** Reconnect grouped relations from their anchor (#309)
- **desktop:** Add persistent interface zoom (#311)

## 1.0.0-beta.14 — 2026-11-10

### Features

- **review:** Render notes as markdown and polish ratings (#295)

## 1.0.0-beta.13 — 2026-11-10

### Features

- **import:** Create and activate a view on json import (#292)

### Fixes

- **import:** Update harness for view.create access (#293)

## 1.0.0-beta.12 — 2026-11-10

### Features

- **review:** Cue relation types in recall prompts (#285)
- **chat:** Render markdown tables (#287)
- **chat:** Highlight code blocks (#288)
- **release:** Unify app and plugin publishing (#289)
- **notes:** Restore scroll position per view on reopen (#290)
- **notes:** Add task lists and refine markdown spacing (#291)

## 1.0.0-beta.11 — 2026-11-09

### Fixes

- **ai:** Link batch-added concepts to the turn's initial selection (#281)
- **concept-map:** Downscale oversized png exports (#282)

## 1.0.0-beta.10 — 2026-11-09

### Fixes

- **concept-map:** Let grouped concepts anchor other groups (#280)

## 1.0.0-beta.9 — 2026-11-09

### Features

- **backup:** Add automatic backups with custom folders (#279)

### Fixes

- **plugins:** List skipped plugins clearly in the startup warning (#276)
- **plugins:** Recover unresponsive panels (#277)

## 1.0.0-beta.8 — 2026-11-08

### Fixes

- **site:** Drop screenshot frame and serve webp (#274)

## 1.0.0-beta.7 — 2026-11-06

### Documentation

- **readme:** Refresh screenshot with relation groups (#273)

### Features

- **intro:** Keep example graph optional and show real tabs (#271)

## 1.0.0-beta.6 — 2026-11-06

### Documentation

- **plugins:** Add agent workflow and landing prompt (#268)

### Features

- **concept-map:** Add automatic relation groups (#269)
- **plugins:** Separate private storage by provenance (#263)
- **ai:** Let mcp agents propose local plugins (#266)

### Fixes

- **splash:** Prevent font swaps during startup (#262)
- **site:** Clarify italian editing description (#264)

## 1.0.0-beta.5 — 2026-11-05

### Features

- **mobile:** Add responsive demo showcase (#256)

### Fixes

- **site:** Use fixed dark brand mark in header and footer (#261)

### Performance

- **plugins:** Reuse panel shell across plugin switches (#258)
- **plugins:** Preload and retain built-in panel modules (#260)

## 1.0.0-beta.4 — 2026-11-04

### Documentation

- **readme:** Refresh screenshot for current ui

### Features

- **intro:** Guide users through relations, views and review (#254)
- **site:** Redesign landing around learning and connected knowledge (#255)

## 1.0.0-beta.3 — 2026-11-04

### Features

- **kernel:** Refresh theme tokens and shared node metrics (#253)

## 1.0.0-beta.2 — 2026-11-04

### Documentation

- **readme:** Refresh app screenshot (#235)

### Features

- **concept-map:** Reconnect shared relation endpoints together (#237)
- **plugins:** Allow toggling bundled actions (#248)
- **plugins:** Show ui actions as canvas tabs (#249)
- **export:** Add permission-checked PNG view export (#251)

### Fixes

- Address project review findings (#236)
- Harden host recovery, plugin errors, and electron fuses (#238)
- Harden batch, chat and review data safety (#242)
- **desktop:** Handle tab shortcuts inside plugin panels (#250)

### Performance

- Remove per-frame work from hot interaction paths (#241)
- **plugins:** Speed up panel loading and tab switching (#243)
- **plugins:** Reuse panel frames across view changes (#244)
- **plugins:** Cache badges and remove panel fade (#246)

## 1.0.0-beta.1 — 2026-11-02

### Features

- **site:** Add umami analytics with download events (#228)
- **ui:** Expose view actions and refine canvas controls (#231)
- **search:** Add global search dialog (#232)
- **plugins:** Add action badges with review count (#233)

### Fixes

- **site:** Hide graph on mobile to avoid squashed render (#226)
- **canvas:** Prevent native text selection during shift box-select (#227)
- **updates:** Delay quitAndInstall so restart feedback is visible (#234)

## 1.0.0-alpha.34 — 2026-11-01

### Features

- **mcp:** Persist server intent and autostart (#223)
- **backup:** Add manual backup and restore (#224)

### Fixes

- **vocab:** Localize vocabulary relation labels (#222)
- **desktop:** Integrate native application menus (#225)

## 1.0.0-alpha.33 — 2026-10-31

### Features

- **i18n:** Rename general graph to overview (#217)
- **notes:** Add markdown editing with lists and links (#220)

### Fixes

- **review:** Constrain panel height and balance padding (#218)
- **i18n:** Use overview for general graph labels

## 1.0.0-alpha.32 — 2026-10-30

### Features

- **theme:** Add mist cool light theme (#215)
- **review:** Add FSRS spaced repetition plugin (#216)

## 1.0.0-alpha.31 — 2026-10-30

No user-facing changes.

## 1.0.0-alpha.30 — 2026-10-30

### Features

- **plugin:** Add isolated central UI panels (#212)

## 1.0.0-alpha.29 — 2026-10-29

No user-facing changes.

## 1.0.0-alpha.28 — 2026-10-29

### Documentation

- **readme:** Add learning graph screenshot
- **readme:** Add border to screenshot

### Features

- **updates:** Replace reminders with an update bar (#210)

### Fixes

- **desktop:** Restore windows on their saved monitor (#209)

## 1.0.0-alpha.27 — 2026-10-28

### Documentation

- Refresh product descriptions across app and site

## 1.0.0-alpha.26 — 2026-10-28

### Documentation

- **site:** Remove ai from descriptions and demo label

### Features

- **inspector:** Add invert direction button for relations
- **canvas:** Fade selected edge handles to reveal arrow

## 1.0.0-alpha.25 — 2026-10-27

### Features

- **graph:** Add bold and italic shortcuts for nodes
- **ai:** Add bundled docs and chat activity (#202)
- **plugin:** Streamline authoring and example releases (#204)

### Fixes

- **plugin:** Build example from local SDK artifact

## 1.0.0-alpha.24 — 2026-10-26

### Documentation

- **readme:** Clarify desktop-only plugin installation

### Features

- **graph:** Add bold and italic node emphasis (#201)

## 1.0.0-alpha.23 — 2026-10-26

### Fixes

- **test:** Link release fixture dependencies directly on windows

## 1.0.0-alpha.22 — 2026-10-26

### Breaking Changes

- **plugin:** Rename npm scope from @nesso to @nesso-how
  rename npm scope from @nesso to @nesso-how

### Documentation

- **agents:** Drop readmes from supported behavior sources

### Features

- **plugins:** Add npm discovery and lifecycle management (#200)
- **plugin:** Add optional action icons to view actions
- **vocab:** Extend base vocabulary to ten relation types
- **plugins:** Add paper theme and clarify desktop-only features

### Fixes

- **desktop:** Remember window size and position
- **startup:** Cover plugin loading with the splash
- **desktop:** Refresh maximized state after resizing
- **plugins:** Retain updated state across batch targets
- **plugin:** Add repository metadata for npm provenance

## 1.0.0-alpha.21 — 2026-10-21

### Fixes

- **build:** Quote workspace filter for windows

## 1.0.0-alpha.20 — 2026-10-21

### Features

- **splash:** Show on every launch except refresh

### Fixes

- **desktop:** Compile workspace errors and verify packaged startup

## 1.0.0-alpha.19 — 2026-10-21

### Breaking Changes

- **plugins:** Ship themes and vocabs as data
  ship themes and vocabs as data
- **plugins:** Remove the reads declaration
  remove the reads declaration
- **plugins:** Narrow action writes to content ops
  narrow action writes to content ops
- **plugins:** Drop styles field and view.activate write
  drop styles field and view.activate write

### Documentation

- **agents:** Add pragmatic design guidance

### Features

- **plugins:** Isolate execution and add desktop npm acquisition (#198)
- **inspector:** Add view-wide concept color input
- **graph:** Add canvas shortcuts and shortcuts reference
- **splash:** Add first-run logo splash before intro (#199)

### Fixes

- **canvas:** Drop group selection outline

## 1.0.0-alpha.18 — 2026-10-15

### Features

- **inspector:** Auto-grow concept description textarea

## 1.0.0-alpha.17 — 2026-10-15

### Features

- **concept:** Add color picker with multi-select and seed colors

## 1.0.0-alpha.16 — 2026-10-14

### Features

- **app:** Delete shared concepts with view
- **plugin:** Route full-view delete to view dialog
- **concept-map:** Link creation to selection and confirm full delete
- **plugin:** Cap concept label length in renderer
- **app:** Pass concept label limit to renderer
- **concept-map:** Edit concept labels inline

## 1.0.0-alpha.15 — 2026-10-13

### Documentation

- **ai:** Require paid plan for chatgpt sign-in

### Features

- **intro:** Preview the real inspector without writes
- **concept-map:** Reveal the rest of the graph as context
- **chat:** Apply AI edits directly with undo and summaries

### Fixes

- **app:** Keep unsaved-changes handling during the intro
- **i18n:** Capitalize the preview label in English
- **concept-map:** Block concept creation when interactions are locked
- **export:** Notify only after save picker confirms download
- **concept-map:** Ease out graph framing in intro

## 1.0.0-alpha.14 — 2026-10-12

### Features

- **i18n:** Add simplified chinese and localized seeds
- **site:** Add localized pages and language detection
- **intro:** Add guided introduction and About page
- **concepts:** Add optional descriptions
- **seed:** Add concept descriptions in en, it, zh

### Fixes

- **graph:** Preserve parallel relations through import and restore
- **site:** Reduce flicker when switching languages
- **site:** Inline styles to prevent unstyled graph flashes
- **i18n:** Correct Italian and Chinese translations
- **i18n:** Polish italian and chinese copy
- **assets:** Adapt favicon to browser color scheme
- **app:** Capitalize tab title

## 1.0.0-alpha.13 — 2026-10-12

### Features

- **i18n:** Add simplified chinese and localized seeds (#195)
- **concept-map:** Add copy, cut and paste actions

## 1.0.0-alpha.12 — 2026-10-12

### Documentation

- **readme:** Trim header badges and use app icon

### Features

- **inspector:** Remember active tab and default to details
- **data:** Move local data directory without restart

### Fixes

- **inspector:** Persist inspector open state

## 1.0.0-alpha.11 — 2026-10-11

### Features

- **persistence:** Use indexeddb on web and files on desktop

## 1.0.0-alpha.10 — 2026-10-10

### Fixes

- **release:** Exclude build tooling from universal mac app

## 1.0.0-alpha.9 — 2026-10-10

### Documentation

- **readme:** Clarify desktop app and web demo

### Features

- **release:** Generate changelog and shared release notes
- **downloads:** Detect platform and build universal mac app
- **site:** Add llms documentation index

Release notes are generated from Conventional Commits by `pnpm release`.
