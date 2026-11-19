---
description: Prepare localized desktop highlights and release Nesso after approval
---

Prepare a Nesso release for the requested version or bump: $ARGUMENTS.

Follow the release guide in `docs/releases.md`. Fetch `origin` and its tags, fast-forward the main clone, and verify clean `main`, matching `origin/main`, and passing CI. Ask for a target if none was specified.

Run `pnpm release --preview` with the requested target. Use the exact version from the preview for the rest of the release. Select only changes worth highlighting to desktop users. Draft the translations in a temporary JSON file outside the checkout, or recommend `--no-highlights`. If a target JSON is already committed, review and reuse it instead of overwriting it. Show the proposed notes or explain why there are none, then ask for explicit approval to publish.

After approval, fetch `origin` and its tags again and confirm `main` and `origin/main` still match the commit you previewed. If they changed, regenerate the preview and get approval again. Run `pnpm release <version> --highlights <file>` or `pnpm release <version> --no-highlights`, as approved. Report the tag and workflow status; if publishing fails, consult the guide before retrying.
