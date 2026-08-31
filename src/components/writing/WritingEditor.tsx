// SPDX-License-Identifier: MIT
import { useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { countNotesWords } from '@nesso-how/vocab-learning'
import type { NotesDocument } from '@/types/graph'
import type { Locale } from '@/i18n/registry'
import { asNotesDocument, commitDoc, toEditableDoc } from './docAdapters'
import { createTrailingDebounce } from './debounce'
import { SLASH_MENU_LABEL_KEY } from './SlashMenu'
import { Callout } from './extensions/callout'
import { Example } from './extensions/example'
import { SlashCommand } from './extensions/slashCommand'

/** Undo granularity is per writing pause; TipTap owns in-editor ⌘Z. */
const COMMIT_DEBOUNCE_MS = 800

/** Key-order-insensitive deep equality for JSON-shaped notes documents, used
 *  to recognize post-save prop refreshes (same content, fresh object). */
function notesDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, i) => notesDeepEqual(item, b[i]))
  }
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  return keysA.every((key) =>
    notesDeepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  )
}

/**
 * Rich-text notes editor for one concept (mounted inside the WritingMode
 * overlay).
 *
 * Commit lifecycle: each edit updates the pending doc and an ~800 ms trailing
 * debounce commits it through `commitDoc` (canonical `undefined` when the
 * document is empty). On unmount the pending timer is canceled and any pending
 * edit flushes exactly once — nothing commits after unmount.
 *
 * Remount contract: `identityKey` is required and authoritative — Task 13
 * passes the concept's `nodeId` and keys this component by the same value
 * (`<WritingEditor key={nodeId} identityKey={nodeId} … />`). The reset path
 * runs ONLY for genuine concept switches:
 *
 * - `identityKey` change → always reset: the trailing debounce is canceled
 *   first (dropping its pending value), then the component pending doc is
 *   cleared and content is reset update-free. This also covers equal notes
 *   under a different key.
 * - Same `identityKey`, changed `initialNotes` → absorbed silently when the
 *   incoming notes are deep-equal to the last document handed to `onCommit`
 *   (a post-save prop refresh), so selection, undo history, and any newer
 *   pending edit survive; reset in place otherwise.
 */
interface Props {
  /** Required, authoritative concept identity; Task 13 passes `nodeId`. */
  identityKey: string
  /** Localized, stable label for the slash menu listbox; Task 13 passes
   *  `t.writing.pill`. Falls back to `placeholder` when absent. */
  menuLabel?: string
  definition: string
  placeholder: string
  initialNotes: NotesDocument | undefined
  onCommit: (notes: NotesDocument | undefined) => void
  onWordCountChange: (words: number) => void
  snippets: Locale['writing']['snippets']
}

export function WritingEditor({
  identityKey,
  menuLabel,
  definition,
  placeholder,
  initialNotes,
  onCommit,
  onWordCountChange,
  snippets,
}: Props) {
  const pendingRef = useRef<NotesDocument | undefined>(undefined)
  const lastIdentityRef = useRef<{ identityKey: string; notes: NotesDocument | undefined }>({
    identityKey,
    notes: initialNotes,
  })
  // The last document handed to `onCommit` (or the initial/reset content) —
  // the baseline same-identity prop refreshes are compared against.
  const committedRef = useRef<NotesDocument | undefined>(initialNotes)
  const onCommitRef = useRef(onCommit)
  onCommitRef.current = onCommit
  const onWordCountRef = useRef(onWordCountChange)
  onWordCountRef.current = onWordCountChange
  const scheduleRef = useRef<ReturnType<typeof createTrailingDebounce<NotesDocument>> | null>(null)
  if (scheduleRef.current === null) {
    scheduleRef.current = createTrailingDebounce<NotesDocument>((doc) => {
      pendingRef.current = undefined
      const committed = commitDoc(doc)
      committedRef.current = committed
      onCommitRef.current(committed)
    }, COMMIT_DEBOUNCE_MS)
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Callout,
      Example,
      Placeholder.configure({ placeholder }),
      SlashCommand.configure({ snippets }),
    ],
    content: toEditableDoc(initialNotes),
    autofocus: 'end',
    onUpdate: ({ editor: ed }) => {
      const doc = asNotesDocument(ed.getJSON())
      pendingRef.current = doc
      onWordCountChange(countNotesWords(doc))
      scheduleRef.current?.(doc)
    },
  })

  // Localized, stable listbox label for the slash menu (see SLASH_MENU_LABEL_KEY).
  const resolvedMenuLabel = menuLabel ?? placeholder
  useEffect(() => {
    if (!editor) return
    ;(editor.storage as unknown as Record<string, unknown>)[SLASH_MENU_LABEL_KEY] =
      resolvedMenuLabel
  }, [editor, resolvedMenuLabel])

  // Identity-aware reset (see the remount contract above): a reused editor
  // instance must never display or commit another concept's stale notes, and a
  // post-save refresh for the same concept must never clobber the editor. The
  // reset is update-free so it does not re-enter the commit debounce.
  useEffect(() => {
    if (!editor) return
    const last = lastIdentityRef.current
    const keyChanged = last.identityKey !== identityKey
    const notesChanged = last.notes !== initialNotes
    if (!keyChanged && !notesChanged) return
    lastIdentityRef.current = { identityKey, notes: initialNotes }
    // Same-identity notes revision deep-equal to the last committed document:
    // a post-save prop refresh — absorb it silently.
    if (!keyChanged && notesDeepEqual(initialNotes, committedRef.current)) return
    // Genuine switch: cancel the trailing debounce (dropping its pending
    // value) BEFORE clearing the component-level pending doc, so the stale
    // pause can never commit.
    scheduleRef.current?.cancel()
    pendingRef.current = undefined
    editor.commands.setContent(toEditableDoc(initialNotes), { emitUpdate: false })
    committedRef.current = initialNotes
    onWordCountRef.current(countNotesWords(asNotesDocument(editor.getJSON())))
  }, [editor, initialNotes, identityKey])

  // Report the initial word count once the editor exists so the parent header
  // is correct from mount (onUpdate only fires on subsequent edits).
  useEffect(() => {
    if (editor) onWordCountRef.current(countNotesWords(asNotesDocument(editor.getJSON())))
  }, [editor])

  // Unmount flush: cancel the stale timer and commit any pending doc
  // (canonicalized). For a deleted node the store's updateNodeData no-ops.
  useEffect(() => {
    return () => {
      scheduleRef.current?.cancel()
      const pending = pendingRef.current
      pendingRef.current = undefined
      if (pending !== undefined) onCommitRef.current(commitDoc(pending))
    }
  }, [])

  if (!editor) return null

  return (
    <div
      className="writing-editor"
      data-definition={definition}
      data-identity={identityKey}
      data-menu-label={resolvedMenuLabel}
    >
      <EditorContent editor={editor} />
    </div>
  )
}
