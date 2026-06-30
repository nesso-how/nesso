---
title: Troubleshooting
description: What to do when a banner, the mentor, or an update check doesn't behave as expected.
---

## "This graph was changed on disk while you were editing"

**When it appears**: desktop only. The file watcher noticed the active graph's JSON file changed outside the app (an external editor, a sync tool, another Nesso window) while you had unsaved edits in memory.

The banner offers two actions:

- **Keep my changes**: writes your in-memory version to disk, overwriting the external change.
- **Reload from disk**: discards your in-memory edits and loads the file as it now is on disk. Undo/redo history is cleared in the process.

There's no automatic merge: pick whichever side of the conflict you want to keep.

## Auto-update problems (desktop)

The desktop app checks GitHub Releases once on launch. If checking fails (offline, GitHub unreachable), it stays silent: no banner, no error, just no update for now.

Once an update is found, the banner can show:

- **Version `X` is available**: click **Install & restart** to download and apply it.
- **Installing…**: download/install in progress; the button is disabled and there is no way to cancel.
- **Update failed. Try again?**: the download or install step failed (e.g. lost connectivity mid-download). Click **Retry**.
- **Update installed. Restart Nesso to finish**: the update was applied to disk, but the app couldn't relaunch itself automatically. Quit and reopen Nesso manually.

You can dismiss the available/error states for the rest of the session with the banner's close button; the install-in-progress state has no dismiss, since the install can't be cancelled once started.

## Mentor not responding

If a mentor message fails, the reply bubble shows one of two messages, depending on what went wrong:

- **Can't reach the AI endpoint. Check Settings (`⌘,`) → AI. For local Ollama, run `ollama serve`.** A network-level failure: the endpoint is unreachable, the wrong port, or (on the hosted web app) a CORS rejection from a local Ollama instance. Confirm the base URL in **Settings → AI**, that Ollama (or your server) is actually running, and, if you're on the hosted web app talking to local Ollama, that you started it with `OLLAMA_ORIGINS` set to the app's origin (see [AI mentor](../guides/ai-mentor/#reaching-local-ollama-from-the-hosted-app)).
- **_Hmm._ My voice failed me. Try again, slowly.** The endpoint was reachable but returned an error or a response Nesso couldn't parse (a model name that doesn't exist, a malformed response, a server-side error). Check the model name and that the endpoint actually speaks the OpenAI-compatible `chat/completions` format.

Closing the mentor panel, switching graphs, or clicking **New chat** aborts any in-flight request without showing an error.

## "No AI endpoint configured"

This isn't a failure: it's the mentor's resting state until you've set up an endpoint. It appears whenever **Mentor** is enabled in **Settings → AI** but the base URL or model field is empty. The input stays disabled until both are filled in. See [AI mentor](../guides/ai-mentor/#connecting-a-model) for setup.
