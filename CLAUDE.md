# CLAUDE.md

Developer guide for AI assistants working in this repo. Detailed rules live in `.cursor/rules/`:

| File                                             | Contents                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| [project.mdc](.cursor/rules/project.mdc)         | Project purpose, stack, and architecture overview                                 |
| [components.mdc](.cursor/rules/components.mdc)   | Component responsibilities and data flow                                          |
| [graph-model.mdc](.cursor/rules/graph-model.mdc) | Semantic edge model — categories, relation types, visual encoding                 |
| [store.mdc](.cursor/rules/store.mdc)             | Zustand store shape, mutations, and selector patterns                             |
| [mentor.mdc](.cursor/rules/mentor.mdc)           | Socratic AI mentor — MentorBubble, system prompt, OpenAI-compatible chat API    |
| [conventions.mdc](.cursor/rules/conventions.mdc) | Coding conventions (TypeScript, React, state, naming)                             |
| [constraints.mdc](.cursor/rules/constraints.mdc) | Hard constraints — what NOT to do                                                 |
| [changelog.mdc](.cursor/rules/changelog.mdc)     | `CHANGELOG.md` (Keep a Changelog), **`[Unreleased]`** on each merge, release flow |
| [maintenance.mdc](.cursor/rules/maintenance.mdc) | When and how to keep rules and the README roadmap in sync with the code           |
| [workflow.mdc](.cursor/rules/workflow.mdc)       | Planning with Claude Code → implementing with Cursor Composer                     |
