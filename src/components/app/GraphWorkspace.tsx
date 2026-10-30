import { useRef, type RefObject } from 'react'
import { ConceptMap } from '@nesso-how/concept-map'
import { useMediaQuery } from '@nesso-how/ui'
import { useGraphInteractions } from '../../graph/interactions.ts'
import type { HostStore } from '../../store/types.ts'
import { maxConceptLabelLength } from '../../store/settings.ts'

export function GraphWorkspace({ store, preview = false, suspended = false, bottomInset = 0, onDeleteView, focusRef }: {
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
  const readOnly = preview || compact || suspended
  const { epoch, commands, surfaceProps } = useGraphInteractions(store, { readOnly, preview, onDeleteView, focusRef: target })

  return <div key={epoch} {...surfaceProps} className="h-full w-full">
    <ConceptMap
      store={store}
      commands={commands}
      readOnly={readOnly}
      preview={preview}
      bottomInset={bottomInset}
      focusRef={target}
      conceptLabelMaxLength={maxConceptLabelLength}
    />
  </div>
}
