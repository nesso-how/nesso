---
name: planning
description: Use when you have an approved design (GitHub issue) for a multi-step task, before touching code.
---

# Planning

Turn an approved design into an implementation plan that a developer with zero codebase context could follow. Every task is bite-sized (2–5 minutes), with exact file paths, complete code blocks, and verification steps. DRY. YAGNI. TDD.

<EXTREMELY-IMPORTANT>
Do NOT write any code until the plan is approved by the user. Planning is a design activity, not an implementation activity.
</EXTREMELY-IMPORTANT>

## Input

An approved GitHub issue from the brainstorming phase. Read it in full before planning. If the issue covers multiple independent subsystems that were not decomposed during brainstorming, suggest breaking into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

## Process

### 1. Analyze the codebase

Read the files that will be affected. Understand existing patterns, naming conventions, and architecture before proposing changes. Check:

- Relevant area rules (`.rules/`) for the domain
- Existing similar implementations to follow patterns
- Test infrastructure (`.rules/testing.md`) for the right test level

### 2. Map file structure

Before defining tasks, map which files will be created or modified and what each is responsible for. This is where decomposition decisions get locked in.

- Each file should have one clear responsibility
- Follow existing codebase patterns — do not restructure unilaterally
- Files that change together should live together

### 3. Break into bite-sized tasks

Each task is the smallest unit that carries its own test cycle. Task granularity:

- "Write the failing test" — step
- "Run it to make sure it fails" — step
- "Implement the minimal code to make the test pass" — step
- "Run the tests and make sure they pass" — step

Fold setup, configuration, and scaffolding into the task that needs them. Split only where a reviewer could meaningfully reject one task while approving its neighbor.

### 4. Write each task

Every task must include:

````markdown
### Task N: [Component Name]

**Files:**

- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts:123-145`
- Test: `tests/exact/path/to/test.ts`

**Interfaces:**

- Consumes: [what this task uses from earlier tasks]
- Produces: [what later tasks rely on — exact names and types]

- [ ] **Step 1: Write the failing test**

\```typescript
// complete test code
\```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test path/to/test.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

\```typescript
// complete implementation code
\```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test path/to/test.test.ts`
Expected: PASS
````

### 5. Self-review the plan

Before presenting to the user:

1. **Issue coverage** — does every requirement in the issue have a corresponding task?
2. **Placeholder scan** — no TBD, TODO, "implement later", "add appropriate error handling", "write tests for the above" without actual code
3. **Type consistency** — do types, method signatures, and property names match across tasks?
4. **Constraint check** — does any task violate Nesso hard rules? (see [AGENTS.md → Constraints](../../AGENTS.md#constraints--hard-rules-never-do-this))
5. **YAGNI check** — is anything here that isn't strictly needed?

Fix issues inline.

### 6. Present and get approval

Present the plan to the user. After approval, the session can:

- **End here** — the plan is the handoff artifact. Pick up in a new session at execution.
- **Flow into execution** — hand off to the `building` skill for task-by-task implementation.

## Nesso-Specific Patterns

When writing plans for Nesso, follow these patterns:

- **State** — all mutations go through `useGraphStore` methods. Never push into arrays in place.
- **Components** — functional components with inline styles. See `.rules/components.md`.
- **Types** — centralized in `src/types/`. See `.rules/conventions.md`.
- **Tests** — Vitest for unit/component, Playwright for e2e. See `.rules/testing.md`.
- **Edges** — always `type: 'nesso'`. Never use default React Flow edge types.
- **Colours** — CSS custom properties (`--cat-taxonomic`, etc.). Never hardcoded hex.

## Key Principles

- **Exact file paths always** — never vague references
- **Complete code in every step** — if a step changes code, show the code
- **Exact commands with expected output** — not "run the tests"
- **DRY, YAGNI, TDD, frequent commits** — every task follows these
- **No placeholders** — if you don't know the exact code, the task is not ready
- **Each task is self-contained** — a developer can pick up any task without reading the full plan
