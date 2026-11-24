import { Prec, StateEffect, StateField, type Range } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'

type SearchPosition = { query: string; index: number }

export type NoteSearch = SearchPosition & {
  matches: Range<Decoration>[]
  highlights: DecorationSet
  decorations: DecorationSet
}

export const setNoteSearch = StateEffect.define<SearchPosition | null>()

const matchMark = Decoration.mark({ class: 'notes-match' })
const activeMark = Decoration.mark({ class: 'notes-match notes-match-current' })
const matchTheme = EditorView.baseTheme({
  '.notes-match': {
    background: 'color-mix(in srgb, var(--ring) 16%, var(--background))',
  },
  '.notes-match.notes-match-current': {
    background: 'color-mix(in srgb, var(--ring) 32%, var(--background))',
    boxShadow: 'inset 0 0 0 1px var(--ring)',
  },
})

function findMatches(source: string, query: string) {
  if (!query) return []
  const literal = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return Array.from(source.matchAll(new RegExp(literal, 'giu')), (match) =>
    matchMark.range(match.index, match.index + match[0].length),
  )
}

export const noteSearch = StateField.define<NoteSearch | null>({
  create: () => null,
  update(search, transaction) {
    const change = transaction.effects.find((effect) => effect.is(setNoteSearch))
    if (!change && !transaction.docChanged) return search
    const position = change ? change.value : search
    if (!position) return null
    const { query } = position
    const reuse = !transaction.docChanged && search?.query === query
    const matches = reuse ? search.matches : findMatches(transaction.newDoc.toString(), query)
    const index = Math.min(position.index, Math.max(0, matches.length - 1))
    if (reuse && index === search.index) return search
    const highlights = reuse ? search.highlights : Decoration.set(matches)
    const active = matches[index]
    return {
      query,
      index,
      matches,
      highlights,
      decorations: active
        ? highlights.update({
            filterFrom: active.from,
            filterTo: active.to,
            filter: (from, to) => from !== active.from || to !== active.to,
            add: [activeMark.range(active.from, active.to)],
          })
        : highlights,
    }
  },
  provide: (field) => [
    matchTheme,
    Prec.high(
      EditorView.decorations.from(field, (search) => search?.decorations ?? Decoration.none),
    ),
  ],
})
