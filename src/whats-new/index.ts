import { useCallback, useEffect, useState } from 'react'
import { version } from '../../package.json'
import { selectReleaseNotes, type ReleaseNotes } from './catalog.ts'

const files = import.meta.glob<ReleaseNotes['messages']>('./notes/*.json', {
  eager: true,
  import: 'default',
})

const releaseHistory = selectReleaseNotes(files, version)

export function useWhatsNew(loading: boolean) {
  const [newNotes, setNewNotes] = useState<readonly ReleaseNotes[]>([])
  const [openNotes, setOpenNotes] = useState<readonly ReleaseNotes[] | null>(null)
  useEffect(() => {
    if (loading) return
    let active = true
    void window.nessoWhatsNew?.startup().then(
      (previous) => {
        if (active && previous) setNewNotes(selectReleaseNotes(files, version, previous))
      },
      (error: unknown) => console.error(error),
    )
    return () => {
      active = false
    }
  }, [loading])

  const openHistory = useCallback(() => {
    setNewNotes([])
    setOpenNotes(releaseHistory)
  }, [setNewNotes, setOpenNotes])

  return {
    newNotes,
    openNotes,
    openHistory,
    openLatest: () => {
      setOpenNotes(newNotes)
      setNewNotes([])
    },
    dismiss: () => setNewNotes([]),
    close: () => setOpenNotes(null),
  }
}
