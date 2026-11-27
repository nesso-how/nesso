# Canvas controls and map actions

For a first look at Nesso, open **Settings → About → Introduction** and try the example. This page is for later, when you need a gesture or shortcut or want to know what an edit will change. **Cmd/Ctrl** means Command on macOS and Control on Windows or Linux.

## Explore the graph

Open **Graph** in the Explorer to see every concept at once, with larger bubbles for concepts that have more connections. Clicking a concept highlights its neighbors and shows its notes in the Inspector, and hovering over a concept or line shows the relation types. Double-click a concept to open the map that contains it. When several maps contain it you can choose one, and when none does you can create one.

Drag the background to pan, scroll or pinch to zoom, or press **F** to fit the graph. You can drag a bubble to nudge the automatic layout, which settles once you let go, so arrange the concepts on a map when you want a layout to stay put. The graph and each map remember their own pan and zoom across restarts.

## Work on a map

### Add or reuse a concept

- Double-click an empty spot, or right-click there and choose **Add concept**. You can also use the toolbar or **Cmd/Ctrl+Enter**, and if one concept is selected, the new one is linked to it with the vocabulary's default relation type.
- To build a chain, select a concept and drag its connection handle to empty space. Nesso creates a linked concept there and lets you name it right away, and a single undo removes the whole addition.
- While you name a new concept, Nesso suggests matching concepts from other maps. Choose one to reuse it, or press Enter without choosing to keep a new, independent concept. To add an existing concept later, search for it and choose **Add to map**.
- To rename a concept, double-click its label or select it and press **Enter**. Press Enter or click away to save, or Escape to cancel, and the new label shows up on every map that uses the concept.

### Connect and arrange

Drag a concept's connection handle to another concept, then select the relation to set its type in the Inspector. To reconnect several relations together, select ones that share a source or target and drag that endpoint. A duplicate or self-connection cancels the whole reconnection.

| To…                             | On the map canvas                                                                                                                                                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Select several items            | Shift-drag the background to box-select. Shift-, Ctrl-, or Cmd-click toggles an item. **Cmd/Ctrl+A** selects everything visible and **Escape** clears the selection. Drag a selected concept to move the selection.                                                          |
| Style labels                    | Select concepts and use **Cmd/Ctrl+B** (bold), **Cmd/Ctrl+I** (italic), or **Cmd/Ctrl+Shift+X** (strikethrough). Styles and colors apply only to this map.                                                                                                                   |
| Bend a relation                 | Select a single relation and drag its midpoint. Double-click the handle or choose **Reset curve** to straighten it back to its automatic path. Grouped and self-relations cannot be bent.                                                                                    |
| Rearrange                       | Press **L** to lay out the selected concepts around the rest, or the whole map if nothing is selected. This resets curves touching the concepts you rearrange.                                                                                                               |
| Group related concepts visually | **G** toggles **Group relations**. Nearby concepts sharing the same relation type and source or target can appear in a box. Click or drag its outline to select or move the concepts, or click its edge to select the relations. Grouping only changes how the map is drawn. |
| Find commands or frame the map  | Right-click a concept, relation, selection, or the background for actions at that spot. **F** fits the view. The canvas lock disables editing gestures, but you can still navigate, copy, and undo.                                                                          |

### Copy, delete, and undo

**Cmd/Ctrl+C**, **X**, and **V** copy, cut, and paste the selection, except in a text field, where they edit text as usual. Pasted concepts join the active map with their labels, relations, and layout. If you paste what you just cut, concepts that still exist elsewhere in the graph are reused instead of duplicated.

**Delete** or **Backspace** removes the selection. What it removes depends on where you are:

- **On a map**, a concept that also belongs to another map is only removed from this one, while a concept that appears nowhere else is deleted from the graph. If you select every concept on the map and press Delete, Nesso asks whether to delete the map.
- **In Graph**, deletion affects the graph itself, so Nesso asks for confirmation when a selected concept belongs to a map. Deleting a relation removes that connection everywhere it appears.

Cut follows the same rules, except that you can't cut every concept in the graph. **Undo** and **Redo** in the toolbar step through graph and map edits, including cut and paste, while a plugin's private data, such as a review rating, has its own controls.

## Notes

Open **Notes** from the map's context menu in the Explorer, or from the Inspector's actions when nothing is selected. It's the place to write about the map as a whole, while text that should follow a concept across maps belongs in that concept's notes in the Inspector. Opened on **Graph**, Notes gives you a single note for the whole document.

The editor supports Markdown formatting and task checkboxes, and saves as you type. While it's focused, **Cmd/Ctrl+F** opens **Find in notes**, where Enter and Shift+Enter step through matches and Escape takes you back to editing. Undo in the editor only affects the note.

Map notes are included in backups but not in JSON-LD exports, and if you undo a map deletion, its note comes back with it. If a save fails, copy the visible draft before you close or switch maps. If the notes fail to load, use **Reload notes** in the warning banner.

## Review

Open **Review** from the map's actions, where its badge counts the concepts that are new or due. In a round, try to recall each concept before revealing the answer. When the concept has connections in this map, the prompt shows their types and directions so you can try to recall what's at the other end, and the answer then shows the concept's notes and connections.

Press **Space** to reveal the answer, then **1–4** to rate it **Again**, **Hard**, **Good**, or **Easy**. The rating schedules the concept's next review across all its maps. To revisit earlier ratings in the round, use **Undo rating** or **Backspace**, which also work from the completion screen. **Escape** or **End session** takes you back to the overview and keeps the ratings you've already given. If progress can't be read or saved, reload it before rating again.

## Share a map or restore your work

| Goal                                                       | Use                                                                                                                                                                        |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Send someone an editable map                               | Choose **Export json** on the map for JSON-LD with concept notes, relations, layout, and styles. Exporting from **Graph** includes all concepts without map layouts.       |
| Share a picture                                            | Choose **Export PNG**. It captures the whole canvas in the current theme, without selection highlights or controls.                                                        |
| Bring another map into your graph                          | **Import json** creates concepts with new IDs and recreates any maps in the file. Without maps, the concepts are added to the graph only. The import is one undo step.     |
| Recover map notes, review progress, and workspace together | Use **Settings → Local data → Backup** on desktop. Restoring a backup also brings back preferences and chat. It doesn't reinstall plugins or restore provider credentials. |
