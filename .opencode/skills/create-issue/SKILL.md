---
name: create-issue
description: Use when the user asks to create or publish a GitHub issue on the nesso-how Nesso org board (gh issue create, "crea issue") and the draft is ready — investigation and triage are already done.
---

# Create a Nesso GitHub issue

Publishes a **fully drafted** issue (title, body, Type, area label, board Status, Priority decided) — does not investigate, triage, or decide priority. Read source, reproduce, check `.rules/*.md` for the affected area first.

No confirmation gate here — the caller (brainstorm / fix / work agent) already gated. Proceed directly.

Before creating:

```bash
gh issue list --search "<keywords>" --state all --limit 5
```

Quick duplicate sanity check — not exhaustive.

## Gotchas

- **Type is not a label.** Use `gh issue create --type <Name>` (Bug, Feature, Refactor, Docs, Chore). **Refactor** = no user-visible behavior change; UX changes are Feature.
- **Priority is an org Issue Field, not a project field.** `gh project item-edit` cannot set it (fails silently). Use GraphQL `setIssueFieldValue` in step 4. **Status** is a project field — `gh project item-edit` in step 3. Different APIs; don't mix them.
- **Discover Priority field/option ids fresh** every run — org Issue Fields drift in the GitHub UI; don't reuse stale ids.
- **`clientMutationId: null`** on the Priority mutation is normal; GraphQL `errors` is the failure signal.

## 1. Prepare the draft

Recap all fields. **Status:** **Ready** if specified enough to start; **Inbox** if still needs triage (`gh project view 1 --owner nesso-how`).

## 2. Create the issue

```bash
gh issue create \
  --title "<title>" \
  --type <Bug|Feature|Refactor|Docs|Chore> \
  --label "<area: xyz>" \
  --body "$(cat <<'EOF'
<body — mirror matching .github/ISSUE_TEMPLATE/*.yml as ## sections>
EOF
)"
```

Capture the issue URL. Body shape by Type:

- **Bug** (`bug_report.yml`) — add `## Root cause` / `## Suggested fix direction` with `file:line` when known
- **Feature** (`feature_request.yml`)
- **Chore** (`tooling.yml`)
- **Graph model** (`graph_model.yml`) — read template; richer structure

## 3. Add to the project board and set Status

```bash
ITEM_ID=$(gh project item-add 1 --owner nesso-how --url <issue-url> --format json | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")

gh project item-edit \
  --project-id PVT_kwDOETTSk84Bc6My \
  --id "$ITEM_ID" \
  --field-id PVTSSF_lADOETTSk84Bc6MyzhXfk9k \
  --single-select-option-id <status-option-id>
```

Re-verify Status option ids with `gh project field-list 1 --owner nesso-how --format json` if stale — last known: Inbox `b33f88dd`, Ready `566a9694`, In Progress `98e3405f`, In Review `7630fa6c`, Done `bb1f65af`.

## 4. Set Priority (org-level Issue Field)

Discover → set → verify.

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

**Get issue node id** (not the project item id):

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

## Checklist

- [ ] Duplicate check run
- [ ] Issue created with `--type` (not a legacy label)
- [ ] Added to project 1; Status set
- [ ] Priority set via `setIssueFieldValue`; verified on issue
