// SPDX-License-Identifier: MIT
import { useCallback, useEffect, useRef } from 'react'
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

function arraysDeepEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false
  return a.every((item, i) => notesDeepEqual(item, b[i]))
}

function objectsDeepEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  return keysA.every((key) => notesDeepEqual(a[key], b[key]))
}

function isObjectValue(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Compare two object-shaped values of the same kind (both arrays, or both
 *  plain objects); mismatched kinds are never equal. */
function sameKindDeepEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && arraysDeepEqual(a, b)
  }
  return objectsDeepEqual(a, b)
}

function notesDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!isObjectValue(a) || !isObjectValue(b)) return false
  return sameKindDeepEqual(a, b)
}

/**
 * Reset decision for the identity-aware effect (see the remount contract on
 * `WritingEditor`): 'none' = same identity and same notes object (no-op),
 * 'absorb' = same-identity notes revision deep-equal to the last committed
 * document (a post-save prop refresh), 'reset' = a genuine concept switch.
 */
function resetAction(
  last: { identityKey: string; notes: NotesDocument | undefined },
  identityKey: string,
  initialNotes: NotesDocument | undefined,
  committed: NotesDocument | undefined,
): 'none' | 'absorb' | 'reset' {
  const keyChanged = last.identityKey !== identityKey
  if (keyChanged) return 'reset'
  if (last.notes === initialNotes) return 'none'
  return notesDeepEqual(initialNotes, committed) ? 'absorb' : 'reset'
}

/**
 * Commit pipeline for Writing Mode notes edits: every edit schedules an
 * ~800 ms trailing commit through `commitDoc` (canonical `undefined` when the
 * document is empty). On unmount the pending timer is canceled and any pending
 * edit flushes exactly once — nothing commits after unmount. `cancel()` drops
 * the pending edit and cancels the scheduled commit (genuine concept switch).
 */
function useNotesCommit(onCommit: (notes: NotesDocument | undefined) => void): {
  schedule: (doc: NotesDocument) => void
  cancel: () => void
} {
  const pendingRef = useRef<NotesDocument | undefined>(undefined)
  const onCommitRef = useRef(onCommit)
  onCommitRef.current = onCommit
  const scheduleRef = useRef<ReturnType<typeof createTrailingDebounce<NotesDocument>> | null>(null)
  if (scheduleRef.current === null) {
    scheduleRef.current = createTrailingDebounce<NotesDocument>((doc) => {
      pendingRef.current = undefined
      onCommitRef.current(commitDoc(doc))
    }, COMMIT_DEBOUNCE_MS)
  }

  // Ref-only callbacks memoized with empty deps: their identity never changes,
  // so effects can close over them without re-subscribing per render.
  const schedule = useCallback((doc: NotesDocument) => {
    pendingRef.current = doc
    scheduleRef.current?.(doc)
  }, [])

  const cancel = useCallback(() => {
    scheduleRef.current?.cancel()
    pendingRef.current = undefined
  }, [])

  // Unmount flush: cancel the stale timer and commit any pending doc
  // (canonicalized). For a deleted node the store's updateNodeData no-ops.
  // The pending doc is read before `cancel()` clears it; the timer is still
  // canceled before the flush fires, so nothing can commit twice. `cancel`
  // is stable, so this effect subscribes exactly once per hook instance.
  useEffect(() => {
    return () => {
      const pending = pendingRef.current
      cancel()
      if (pending !== undefined) onCommitRef.current(commitDoc(pending))
    }
  }, [cancel])

  return { schedule, cancel }
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
  const lastIdentityRef = useRef<{ identityKey: string; notes: NotesDocument | undefined }>({
    identityKey,
    notes: initialNotes,
  })
  // The last document handed to `onCommit` (or the initial/reset content) —
  // the baseline same-identity prop refreshes are compared against.
  const committedRef = useRef<NotesDocument | undefined>(initialNotes)
  const onWordCountRef = useRef(onWordCountChange)
  onWordCountRef.current = onWordCountChange
  // Both callbacks are memoized ref-only functions — stable across renders.
  const { schedule, cancel } = useNotesCommit((committed) => {
    committedRef.current = committed
    onCommit(committed)
  })

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
      // Register the pending edit (and start the trailing debounce) BEFORE any
      // re-entrant work: onWordCountChange may synchronously unmount the
      // editor, and the unmount flush must always see this pending edit.
      schedule(doc)
      onWordCountChange(countNotesWords(doc))
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
  // reset path runs ONLY for genuine concept switches:
  //
  // - `identityKey` change → always reset: the trailing debounce is canceled
  //   first (dropping its pending value), then the component pending doc is
  //   cleared and content is reset update-free. This also covers equal notes
  //   under a different key.
  // - Same `identityKey`, changed `initialNotes` → absorbed silently when the
  //   incoming notes are deep-equal to the last document handed to `onCommit`
  //   (a post-save prop refresh), so selection, undo history, and any newer
  //   pending edit survive; reset in place otherwise.
  useEffect(() => {
    if (!editor) return
    const action = resetAction(
      lastIdentityRef.current,
      identityKey,
      initialNotes,
      committedRef.current,
    )
    if (action === 'none') return
    lastIdentityRef.current = { identityKey, notes: initialNotes }
    // Same-identity notes revision deep-equal to the last committed document:
    // a post-save prop refresh — absorb it silently.
    if (action === 'absorb') return
    // Genuine switch: cancel the trailing debounce (dropping its pending
    // value) BEFORE clearing the component-level pending doc, so the stale
    // pause can never commit.
    cancel()
    editor.commands.setContent(toEditableDoc(initialNotes), { emitUpdate: false })
    committedRef.current = initialNotes
    onWordCountRef.current(countNotesWords(asNotesDocument(editor.getJSON())))
  }, [cancel, editor, initialNotes, identityKey])

  // Report the initial word count once the editor exists so the parent header
  // is correct from mount (onUpdate only fires on subsequent edits).
  useEffect(() => {
    if (editor) onWordCountRef.current(countNotesWords(asNotesDocument(editor.getJSON())))
  }, [editor])

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
