---
title: Graph management
description: Working with multiple graphs, exporting and importing JSON, and desktop project folders.
---

A **graph** is one map: its concepts, relations, and display settings. You can keep several graphs and switch between them, export or import any of them as JSON, and, on desktop, group graphs into project folders.

## Multiple graphs

The **Sidebar** lists every graph in the current project. Click a graph to switch to it: the canvas, Inspector, and Review queue all follow.

- **Rename**: double-click a graph's row in the list, type the new name, `Enter` to commit.
- **Delete**: hover a row and click the trash icon. You're asked to confirm. Deleting also removes its file from the project folder on desktop. The last remaining graph can't be deleted, so the delete action is hidden when only one graph is left.
- **New graph**: the **New** button above the list creates an empty graph and switches to it immediately.

Switching graphs flushes any pending autosave on the one you're leaving, so edits made just before a switch aren't lost.

## Export and import (JSON)

Open the **⋯** menu in the top bar (tooltip: "Export · Import · Shortcuts") for:

- **Export graph**: saves the active graph as a `.json` file named after the graph.
- **Export graph (.png)**: renders the canvas at 1920×1200 and saves it as an image, with React Flow's selection handles excluded from the render.
- **Import graph**: opens a file picker for a `.json` file and adds it as a new graph.

Export behaves differently depending on platform:

- **Desktop**: a native save dialog lets you pick the destination.
- **Web**: if your browser supports the File System Access API, you get a save dialog and can overwrite the same file on repeat exports. Otherwise it falls back to a normal browser download.

Importing a file that isn't a valid Nesso graph shows an error toast and imports nothing. A successful import creates a new graph (de-duplicating its name against your existing graphs) and switches to it.

Exported JSON carries graph **content** only: concepts, relations, and display settings. Personal review progress (FSRS data) is never included, so sharing or re-importing a file never carries someone else's recall history.

## File compatibility

Nesso graph files carry separate envelope and vocabulary versions. When you
import a file or open a desktop project, released older beta formats are
upgraded through sequential compatibility steps. A file created by a newer
unsupported Nesso version is rejected so its data is not interpreted
incorrectly.

The first supported baseline is the definition-only graph shape introduced
before `0.2.0-beta.0`. Earlier alpha-only `examples`, `notes`, and image
fields are not migrated. Review scheduling state is stored separately and is
not included in exported graph files.

## Desktop projects

On the desktop app, graphs live inside **project folders**: plain directories on disk holding one JSON file per graph plus a small manifest. The **Projects** section in the sidebar (desktop only) lists every folder you've opened and lets you switch between them.

- **Add project**: the **+** button opens a native folder picker. Pick an existing project folder, or create a new one from the dialog's "New Folder" button (macOS). The selected folder becomes the active project.
- **Switch project**: click any project in the list. The current graph is saved first, then the target folder's graphs load.
- **Remove project**: hover a project and click the trash icon, then confirm. This only removes it from Nesso's list. Its files stay on disk untouched. You can't remove the last project in the list.
- **Reveal in Finder**: hover a project and click the folder icon to reveal it in the system file manager.

If a project folder is moved, renamed, or deleted outside the app, it stays in the list marked as missing (greyed out, with a "not found" label) rather than disappearing. Switching away from a missing project happens automatically. Switching back works again once the folder reappears at the same path. Only the trash icon removes it from the list for good.

If every file in a project folder uses a vocabulary or format version that this release of Nesso cannot read, the project is blocked: Nesso does not switch to it, does not create new files inside it, and does not overwrite any of the unsupported files. A banner explains what happened, and the previous project stays active. See [Troubleshooting](../../troubleshooting/#unsupported-project-files-desktop) for recovery steps.

:::caution
Native folder pickers and the system menu bar are desktop-only Tauri APIs. None of this section applies to the web app, which has a single implicit workspace backed by IndexedDB. See [FAQ](../../faq/#what-changes-between-the-web-app-and-the-desktop-app) for the full web/desktop comparison.
:::
