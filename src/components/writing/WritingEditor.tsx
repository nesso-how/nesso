// SPDX-License-Identifier: MIT
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { exitSuggestion, SuggestionPluginKey } from '@tiptap/suggestion'
import { countNotesWords, isValidNotesDocument } from '@nesso-how/vocab-learning'
import type { NotesDocument } from '@/types/graph'
import type { Locale } from '@/i18n/registry'
import { asNotesDocument, commitDoc, toEditableDoc } from './docAdapters'
import { SLASH_MENU_LABEL_KEY } from './SlashMenu'
import { Callout } from './extensions/callout'
import { Example } from './extensions/example'
import { SlashCommand } from './extensions/slashCommand'

const DEFAULT_INVALID_NOTES_MESSAGE =
  'This note is too large or contains unsupported formatting and won’t be saved'

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

function isObjectValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

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

function resetAction(
  last: { identityKey: string; notes: NotesDocument | undefined },
  identityKey: string,
  initialNotes: NotesDocument | undefined,
  latestCommit: NotesDocument | undefined,
): 'none' | 'absorb' | 'reset' {
  if (last.identityKey !== identityKey) return 'reset'
  if (last.notes === initialNotes) return 'none'
  return notesDeepEqual(initialNotes, latestCommit) ? 'absorb' : 'reset'
}

interface Props {
  identityKey: string
  menuLabel?: string
  definition: string
  placeholder: string
  initialNotes: NotesDocument | undefined
  onCommit: (notes: NotesDocument | undefined) => void
  onEscape?: () => void
  onWordCountChange?: (words: number) => void
  invalidNotesMessage?: string
  snippets: Locale['writing']['snippets']
}

function useWritingEditor({
  identityKey,
  menuLabel,
  placeholder,
  initialNotes,
  onCommit,
  onEscape,
  onWordCountChange,
  invalidNotesMessage = DEFAULT_INVALID_NOTES_MESSAGE,
  snippets,
}: Props) {
  const lastIdentityRef = useRef<{ identityKey: string; notes: NotesDocument | undefined }>({
    identityKey,
    notes: initialNotes,
  })
  const latestCommitRef = useRef<NotesDocument | undefined>(initialNotes)
  const onCommitRef = useRef(onCommit)
  onCommitRef.current = onCommit
  const onWordCountRef = useRef(onWordCountChange)
  onWordCountRef.current = onWordCountChange
  const [hasInvalidNotes, setHasInvalidNotes] = useState(false)

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
      const json = ed.getJSON()
      if (!isValidNotesDocument(json)) {
        setHasInvalidNotes(true)
        return
      }

      setHasInvalidNotes(false)
      const doc = asNotesDocument(json)
      const committed = commitDoc(doc)
      latestCommitRef.current = committed
      onCommitRef.current(committed)
      const reportWordCount = onWordCountRef.current
      if (reportWordCount) reportWordCount(countNotesWords(doc))
    },
  })

  const resolvedMenuLabel = menuLabel ?? placeholder
  useEffect(() => {
    if (!editor) return
    ;(editor.storage as unknown as Record<string, unknown>)[SLASH_MENU_LABEL_KEY] =
      resolvedMenuLabel
  }, [editor, resolvedMenuLabel])

  useEffect(() => {
    if (!editor) return
    const action = resetAction(
      lastIdentityRef.current,
      identityKey,
      initialNotes,
      latestCommitRef.current,
    )
    if (action === 'none') return

    lastIdentityRef.current = { identityKey, notes: initialNotes }
    if (action === 'absorb') return

    setHasInvalidNotes(false)
    editor.commands.setContent(toEditableDoc(initialNotes), { emitUpdate: false })
    latestCommitRef.current = initialNotes
    const reportWordCount = onWordCountRef.current
    if (reportWordCount) reportWordCount(countNotesWords(asNotesDocument(editor.getJSON())))
  }, [editor, initialNotes, identityKey])

  useEffect(() => {
    if (!editor) return
    const reportWordCount = onWordCountRef.current
    if (reportWordCount) reportWordCount(countNotesWords(asNotesDocument(editor.getJSON())))
  }, [editor])

  const handleEscape = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const suggestionState = editor
        ? (SuggestionPluginKey.getState(editor.state) as { active?: boolean } | undefined)
        : undefined
      if (suggestionState?.active && editor) {
        event.preventDefault()
        event.stopPropagation()
        exitSuggestion(editor.view)
        return
      }
      if (!onEscape) return
      event.preventDefault()
      event.stopPropagation()
      onEscape()
    },
    [editor, onEscape],
  )

  return { editor, resolvedMenuLabel, handleEscape, hasInvalidNotes, invalidNotesMessage }
}

export function WritingEditor(props: Props) {
  const { editor, resolvedMenuLabel, handleEscape, hasInvalidNotes, invalidNotesMessage } =
    useWritingEditor(props)

  return (
    <div
      className="writing-editor"
      data-definition={props.definition}
      data-identity={props.identityKey}
      data-menu-label={resolvedMenuLabel}
      onKeyDownCapture={handleEscape}
    >
      {hasInvalidNotes && (
        <div
          role="alert"
          data-testid="writing-editor-validation"
          style={{
            marginBottom: 'var(--space-3)',
            color: 'var(--danger)',
            fontSize: 'var(--text-sm)',
          }}
        >
          {invalidNotesMessage}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}
