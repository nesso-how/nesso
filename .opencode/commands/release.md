---
description: Release Nesso with localized desktop highlights after approval
---

Target: $ARGUMENTS

Follow `docs/releases.md`, asking for a version or bump if none is given, and use the exact version from `pnpm release --preview` from then on. Draft translated highlights only for changes worth showing desktop users, or recommend `--no-highlights`; if notes for the version are already committed, review and reuse them. Show the proposed notes and ask for approval to publish.

After approval, fetch `origin` and its tags again and confirm `main` still matches the previewed commit; if not, preview and ask again. Publish as approved, then report the tag and workflow status.
