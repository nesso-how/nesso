import { ConceptMap } from '@nesso/concept-map'
import { useMediaQuery } from '@nesso/ui'
import type { HostStore } from '../../store/types.ts'
import { notifications } from '../../notifications/index.ts'
import { useNessoStore } from '../../store/index.ts'
import { maxConceptLabelLength } from '../../store/settings.ts'

export function ConceptMapSurface({ store, preview = false, bottomInset = 0, onDeleteView }: { store: HostStore; preview?: boolean; bottomInset?: number; onDeleteView?: () => void }) {
  const compact = useMediaQuery('(max-width: 767px)')
  const epoch = useNessoStore((state) => state.documentEpoch, store)
  return <ConceptMap key={epoch} store={store} notifications={notifications.api} clipboard={navigator.clipboard} readOnly={preview || compact} preview={preview} bottomInset={bottomInset} onDeleteView={onDeleteView} conceptLabelMaxLength={maxConceptLabelLength} />
}
