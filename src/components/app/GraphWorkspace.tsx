import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ComponentProps,
  type Ref,
  type RefObject,
} from 'react'
import { ConceptMap, type ConceptMapHandle } from '@nesso-how/concept-map'
import type { Position } from '@nesso-how/schema'
import { useGraphInteractions } from '../../graph/interactions.ts'
import type { HostStore } from '../../store/types.ts'
import { maxConceptLabelLength } from '../../store/settings.ts'
import { useTranslation } from '@/i18n'

export function GraphWorkspace({
  ref,
  store,
  preview = false,
  readOnly: locked = false,
  connection,
  suspended = false,
  bottomInset = 0,
  onDeleteView,
  onConfirmDelete,
  focusRef,
}: {
  ref?: Ref<ConceptMapHandle>
  store: HostStore
  preview?: boolean
  readOnly?: boolean
  connection?: ComponentProps<typeof ConceptMap>['connection']
  suspended?: boolean
  bottomInset?: number
  onDeleteView?: () => void
  onConfirmDelete?: () => void
  focusRef?: RefObject<HTMLDivElement | null>
}) {
  const t = useTranslation()
  const overview = useSyncExternalStore(
    store.subscribe,
    () => store.getState().workspace.activeViewId === null,
  )
  const localFocus = useRef<HTMLDivElement>(null)
  const target = focusRef ?? localFocus
  const readOnly = preview || locked
  const { epoch, commands, surfaceProps } = useGraphInteractions(store, {
    readOnly: readOnly || suspended,
    preview,
    onDeleteView,
    onConfirmDelete,
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
      {overview ? (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          {t('overviewPlaceholder')}
        </div>
      ) : (
        <ConceptMap
          ref={ref}
          store={store}
          commands={rendererCommands}
          readOnly={readOnly}
          preview={preview}
          connection={connection}
          bottomInset={bottomInset}
          focusRef={target}
          conceptLabelMaxLength={maxConceptLabelLength}
          onPresentation={preview ? undefined : store.setConceptMapPresentation}
        />
      )}
    </div>
  )
}
