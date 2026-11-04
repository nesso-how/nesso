import { useEffect, useLayoutEffect, useMemo, useRef, type Ref, type RefObject } from 'react'
import { ConceptMap, type ConceptMapHandle } from '@nesso-how/concept-map'
import type { Position } from '@nesso-how/schema'
import { useMediaQuery } from '@nesso-how/ui'
import { useGraphInteractions } from '../../graph/interactions.ts'
import type { HostStore } from '../../store/types.ts'
import { maxConceptLabelLength } from '../../store/settings.ts'

export function GraphWorkspace({
  ref,
  store,
  preview = false,
  suspended = false,
  bottomInset = 0,
  onDeleteView,
  focusRef,
}: {
  ref?: Ref<ConceptMapHandle>
  store: HostStore
  preview?: boolean
  suspended?: boolean
  bottomInset?: number
  onDeleteView?: () => void
  focusRef?: RefObject<HTMLDivElement | null>
}) {
  const compact = useMediaQuery('(max-width: 767px)')
  const localFocus = useRef<HTMLDivElement>(null)
  const target = focusRef ?? localFocus
  const readOnly = preview || compact
  const { epoch, commands, surfaceProps } = useGraphInteractions(store, {
    readOnly: readOnly || suspended,
    preview,
    onDeleteView,
    focusRef: target,
  })
  const currentCommands = useRef(commands)
  useLayoutEffect(() => {
    currentCommands.current = commands
  }, [commands])
  const rendererCommands = useMemo(
    () => ({
      deleteSelection: () => currentCommands.current.deleteSelection(),
      copy: (cut?: boolean) => currentCommands.current.copy(cut),
      paste: (text?: string, position?: Position) => currentCommands.current.paste(text, position),
    }),
    [],
  )
  useEffect(() => {
    if (!readOnly && !suspended) target.current?.focus()
  }, [readOnly, suspended, target])

  return (
    <div key={epoch} {...surfaceProps} className="h-full w-full">
      <ConceptMap
        ref={ref}
        store={store}
        commands={rendererCommands}
        readOnly={readOnly}
        preview={preview}
        bottomInset={bottomInset}
        focusRef={target}
        conceptLabelMaxLength={maxConceptLabelLength}
      />
    </div>
  )
}
