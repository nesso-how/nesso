import { useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { StateEffect } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { ActionIcon, IconButton, Input, PluginContent } from '@nesso-how/ui'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { noteSearch, setNoteSearch, type NoteSearch } from './find.ts'

export function NotesFind({
  editor,
  labels,
  children,
}: {
  editor: RefObject<HTMLDivElement | null>
  labels: Record<'label' | 'previous' | 'next' | 'close', string>
  children: (controls: { button: ReactNode; bar: ReactNode }) => ReactNode
}) {
  const input = useRef<HTMLInputElement>(null)
  const searchId = useId()
  const [search, setSearch] = useState<NoteSearch | null>(null)
  const open = search !== null
  const total = search?.matches.length ?? 0

  useLayoutEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  const getView = () => editor.current && EditorView.findFromDOM(editor.current)

  const searchFor = (query: string, index: number) => {
    const view = getView()
    if (!view) return
    const effects: StateEffect<unknown>[] = []
    if (view.state.field(noteSearch, false) === undefined) {
      effects.push(
        StateEffect.appendConfig.of([
          noteSearch,
          EditorView.updateListener.of(({ state, startState }) => {
            const current = state.field(noteSearch)
            if (current !== startState.field(noteSearch, false)) setSearch(current)
          }),
        ]),
      )
    }
    effects.push(setNoteSearch.of({ query, index }))
    view.dispatch({ effects })
    const match = view.state.field(noteSearch)?.matches[index]
    if (match) view.dispatch({ effects: EditorView.scrollIntoView(match.from, { y: 'center' }) })
  }

  const move = (direction: -1 | 1) => {
    if (search && total) searchFor(search.query, (search.index + direction + total) % total)
  }

  const openFind = () => {
    if (!open) return searchFor('', 0)
    input.current?.focus()
    input.current?.select()
  }

  const close = () => {
    const view = getView()
    if (!view) return
    const effects = setNoteSearch.of(null)
    if (view.root.activeElement === view.contentDOM) return view.dispatch({ effects })
    const match = search?.matches[search.index]
    view.dispatch({
      effects,
      selection: match ? { anchor: match.from, head: match.to } : undefined,
      scrollIntoView: !!match,
    })
    view.focus()
  }

  return (
    <div
      className="notes-find-scope"
      onKeyDownCapture={(event) => {
        if (event.nativeEvent.isComposing) return
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          event.stopPropagation()
          close()
        } else if (
          event.key.toLowerCase() === 'f' &&
          (event.metaKey || event.ctrlKey) &&
          !event.altKey &&
          !event.shiftKey
        ) {
          event.preventDefault()
          event.stopPropagation()
          openFind()
        }
      }}
    >
      {children({
        button: (
          <IconButton
            type="button"
            aria-label={labels.label}
            aria-keyshortcuts="Meta+F Control+F"
            aria-expanded={open}
            aria-controls={open ? searchId : undefined}
            title={labels.label}
            className="pointer-coarse:size-10"
            onClick={openFind}
          >
            <ActionIcon name="search" />
          </IconButton>
        ),
        bar: search && (
          <div id={searchId} role="search" aria-label={labels.label} className="notes-find">
            <PluginContent className="notes-find-controls">
              <div className="notes-find-field">
                <ActionIcon name="search" size={14} />
                <Input
                  ref={input}
                  aria-label={labels.label}
                  placeholder={labels.label}
                  value={search.query}
                  onChange={(event) => searchFor(event.currentTarget.value, 0)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
                    event.preventDefault()
                    move(event.shiftKey ? -1 : 1)
                  }}
                />
              </div>
              <span role="status">
                {search.query && `${total ? search.index + 1 : 0}/${total}`}
              </span>
              <IconButton
                aria-label={labels.previous}
                title={labels.previous}
                disabled={!total}
                onClick={() => move(-1)}
              >
                <ChevronUp aria-hidden="true" />
              </IconButton>
              <IconButton
                aria-label={labels.next}
                title={labels.next}
                disabled={!total}
                onClick={() => move(1)}
              >
                <ChevronDown aria-hidden="true" />
              </IconButton>
              <IconButton aria-label={labels.close} title={labels.close} onClick={close}>
                <X aria-hidden="true" />
              </IconButton>
            </PluginContent>
          </div>
        ),
      })}
    </div>
  )
}
