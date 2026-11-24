import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { StateEffect } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { ActionIcon, IconButton, Input, PluginContent } from '@nesso-how/ui'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { noteSearch, setNoteSearch, type NoteSearch } from './find.ts'

export function NotesFind({
  labels,
  children,
}: {
  labels: Record<'label' | 'previous' | 'next' | 'close', string>
  children: (bar: ReactNode) => ReactNode
}) {
  const container = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState<NoteSearch | null>(null)
  const open = search !== null
  const total = search?.matches.length ?? 0

  useLayoutEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  const getView = () => container.current && EditorView.findFromDOM(container.current)

  const searchFor = (query: string, index: number) => {
    const view = getView()
    if (!view) return
    if (view.state.field(noteSearch, false) === undefined) {
      view.dispatch({
        effects: StateEffect.appendConfig.of([
          noteSearch,
          EditorView.contentAttributes.of({ tabindex: '0' }),
          EditorView.updateListener.of(({ state, startState }) => {
            const current = state.field(noteSearch)
            if (current !== startState.field(noteSearch, false)) setSearch(current)
          }),
        ]),
      })
    }
    view.dispatch({ effects: setNoteSearch.of({ query, index }) })
    const match = view.state.field(noteSearch)?.matches[index]
    if (match) view.dispatch({ effects: EditorView.scrollIntoView(match.from, { y: 'center' }) })
  }

  const move = (direction: -1 | 1) => {
    if (search && total) searchFor(search.query, (search.index + direction + total) % total)
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
      ref={container}
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
          if (open) {
            input.current?.focus()
            input.current?.select()
          } else searchFor('', 0)
        }
      }}
    >
      {children(
        search && (
          <div role="search" aria-label={labels.label} className="notes-find">
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
      )}
    </div>
  )
}
