---
name: create-issue
description: Publish an already-drafted bug, feedback, or feature as a GitHub issue on the nesso-how "Nesso" org project board, with the correct native Issue Type, area label, board Status, and Priority (including the org-level Priority field, which is not a project field). Use once a bug/feedback item has been investigated and drafted (title, body, type, labels, status, priority all decided) — this skill only publishes, it does not decide what should become an issue or triage severity.
---

# Create a Nesso GitHub issue

This skill takes a **fully drafted** issue (title, body, Type, area label, target board Status, target Priority already decided) and publishes it: creates the GitHub issue, adds it to the org project board, and sets Status + Priority. It does not investigate root causes or decide priority for you — do that first (read the relevant source, reproduce the bug, check `.rules/*.md` for the affected area) and present the draft for confirmation before running anything in this skill.

**Never skip the confirmation gate.** Show the user the final title, Type, label(s), full body, target Status, and target Priority, and get an explicit go-ahead before running `gh issue create` or any mutation below. This applies even when the user asked you to "create the issues" in general — confirm each one's fields, not just the batch.

Before creating, a quick `gh issue list --search "<keywords>" --state all --limit 5` is worth running to catch an obvious duplicate — not exhaustive, just a sanity check.

## Gotchas

- **Type is not a label.** `.github/ISSUE_TEMPLATE/*.yml` used to set `labels: [bug]` / `[feature]` / `[chore]`, but those labels don't exist in the repo anymore — the project moved to native GitHub Issue Types (Bug, Feature, Refactor, Docs, Chore; see the project board's README for the exact meaning of each, especially that **Refactor means no user-visible behavior change** — a UX change is a Feature even if the code also gets simpler). Set it with `gh issue create --type <Name>`, never as a label.
- **Priority is an org-level Issue Field, not a project field.** `gh project field-list` / `gh project item-edit` only see project-scoped `ProjectV2*` fields. The Priority field with the real Now/Next/Later options lives at `organization.issueFields` (GitHub's newer org-wide Issue Fields, same family as Issue Types) and needs the GraphQL `setIssueFieldValue` mutation — see step 4. `gh project item-edit` cannot set it and will not error loudly if you try the wrong field id, it just silently does nothing useful.
- **Discover field/option ids fresh, don't hardcode them.** Org Issue Fields aren't version-controlled and can be renamed/reordered from the GitHub UI outside this repo. Run the discovery query in step 4 every time rather than reusing ids from a previous session or from this file.
- **Status vs Priority use different mutations.** Status (`Inbox`/`Ready`/`In Progress`/`In Review`/`Done`) is a normal project field — `gh project item-edit` works. Priority needs the GraphQL mutation in step 4. Don't try to set both the same way.

## 1. Confirm the draft

Recap for the user: title, Type, label(s), full body, target Status, target Priority. Wait for explicit confirmation.

Status: use **Ready** if the issue is specified enough to start (clear repro/root cause, or a clear proposal for a feature), **Inbox** if it still needs triage or more scoping — matches the board's own definition (see the project README, `gh project view 1 --owner nesso-how`).

## 2. Create the issue

```bash
gh issue create \
  --title "<title>" \
  --type <Bug|Feature|Refactor|Docs|Chore> \
  --label "<area: xyz>" \
  --body "$(cat <<'EOF'
<body, following the matching .github/ISSUE_TEMPLATE/*.yml structure — see below>
EOF
)"
```

Capture the printed issue URL (`https://github.com/nesso-how/nesso/issues/N`).

### Body structure by Type

Mirror the fields from the matching template rather than inventing a new shape:

- **Bug** (`bug_report.yml`): `## Summary`, `## Steps to reproduce`, `## Expected vs actual behavior`, `## Environment`. Add `## Root cause` and `## Suggested fix direction` sections if the investigation found one — cite `file:line`, don't just describe in prose.
- **Feature** (`feature_request.yml`): `## Problem or motivation`, `## Proposed solution`, `## Alternatives considered`.
- **Chore** (`tooling.yml`): `## Problem or friction`, `## Proposed tooling or change`, `## Integration points`, `## Alternatives and trade-offs`.
- **Graph model proposals** specifically use `graph_model.yml`'s richer structure (motivation, type definition with visual + semantic coefficients, concrete examples) — read that template directly if the issue is a relation-type proposal, it's more involved than the others.

## 3. Add to the project board and set Status

```bash
ITEM_ID=$(gh project item-add 1 --owner nesso-how --url <issue-url> --format json | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")

gh project item-edit \
  --project-id PVT_kwDOETTSk84Bc6My \
  --id "$ITEM_ID" \
  --field-id PVTSSF_lADOETTSk84Bc6MyzhXfk9k \
  --single-select-option-id <status-option-id>
```

Status field id `PVTSSF_lADOETTSk84Bc6MyzhXfk9k` is stable (project-scoped fields don't drift the way org Issue Fields do), but re-verify option ids with `gh project field-list 1 --owner nesso-how --format json` if this file feels stale — last known: Inbox `b33f88dd`, Ready `566a9694`, In Progress `98e3405f`, In Review `7630fa6c`, Done `bb1f65af`.

## 4. Set Priority (org-level Issue Field)

Plan-validate-execute: discover the field and option ids, then set, then verify.

**Discover:**

```bash
gh api graphql -f query='
query {
  organization(login: "nesso-how") {
    issueFields(first: 20) {
      nodes {
        ... on IssueFieldSingleSelect { id name options { id name } }
      }
    }
  }
}'
```

Find the `Priority` field's `id` and the option `id` matching the target level (Now / Next / Later).

**Get the issue's node id** (different from the project item id from step 3):

```bash
gh api graphql -f query='query { repository(owner: "nesso-how", name: "nesso") { issue(number: <N>) { id } } }'
```

**Set:**

```bash
gh api graphql -f query='
mutation {
  setIssueFieldValue(input: {
    issueId: "<issue node id>"
    issueFields: [{ fieldId: "<Priority field id>", singleSelectOptionId: "<option id>" }]
  }) { clientMutationId }
}'
```

**Verify:**

```bash
gh api graphql -f query='
query {
  repository(owner: "nesso-how", name: "nesso") {
    issue(number: <N>) {
      issueFieldValues(first: 10) {
        nodes {
          ... on IssueFieldSingleSelectValue {
            field { ... on IssueFieldSingleSelect { name } }
            value
          }
        }
      }
    }
  }
}'
```

`clientMutationId: null` on the mutation response is normal (no client id was sent) — a GraphQL `errors` array is the actual failure signal, not a null field.

## Checklist

- [ ] Draft confirmed with the user (title, Type, label, body, Status, Priority)
- [ ] Quick duplicate check run
- [ ] Issue created with `--type` (not a legacy label)
- [ ] Added to project 1, Status set
- [ ] Priority discovered fresh and set via `setIssueFieldValue`
- [ ] Verified Priority actually applied
