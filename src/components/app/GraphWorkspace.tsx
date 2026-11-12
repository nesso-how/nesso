import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type Ref,
  type RefObject,
} from 'react'
import { ConceptMap, type ConceptMapHandle } from '@nesso-how/concept-map'
import type { SavedView } from '@nesso-how/core'
import { KnowledgeGraph, type KnowledgeGraphHandle } from '@nesso-how/knowledge-graph'
import { newIri, type Position } from '@nesso-how/schema'
import { useGraphInteractions } from '../../graph/interactions.ts'
import type { HostOperation, HostStore } from '../../store/types.ts'
import { defaultViewName } from '../../store/operations.ts'
import { maxConceptLabelLength, maxViewNameLength } from '../../store/settings.ts'
import { OpenViewMenu } from './OpenViewMenu.tsx'

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
  onAddExisting,
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
  onAddExisting?: () => void
  focusRef?: RefObject<HTMLDivElement | null>
}) {
  const overview = useSyncExternalStore(
    store.subscribe,
    () => store.getState().workspace.activeViewId === null,
  )
  const [restoreViewport, setRestoreViewport] = useState(!overview)
  if (overview && restoreViewport) setRestoreViewport(false)
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
  const currentAddExisting = useRef(onAddExisting)
  useLayoutEffect(() => {
    currentCommands.current = commands
    currentAddExisting.current = onAddExisting
  }, [commands, onAddExisting])
  const rendererCommands = useMemo(
    () => ({
      deleteSelection: () => currentCommands.current.deleteSelection(),
      copy: (cut?: boolean) => currentCommands.current.copy(cut),
      paste: (text?: string, position?: Position) => currentCommands.current.paste(text, position),
      addExisting: () => currentAddExisting.current?.(),
    }),
    [],
  )
  useEffect(() => {
    if (!readOnly && !suspended) target.current?.focus()
  }, [readOnly, suspended, target])

  const map = useRef<ConceptMapHandle>(null)
  const graph = useRef<KnowledgeGraphHandle>(null)
  const pending = useRef<string | null>(null)
  useEffect(() => {
    const id = pending.current
    pending.current = null
    if (id !== null) (overview ? graph.current : map.current)?.focusConcept(id)
  }, [overview])
  const focusConcept = (id: string) => {
    if ((store.getState().workspace.activeViewId === null) !== overview) pending.current = id
    else (overview ? graph.current : map.current)?.focusConcept(id)
  }
  useImperativeHandle(ref, () => ({
    focusConcept,
    addToView: (id) => map.current?.addToView(id),
  }))

  const [opening, setOpening] = useState<{
    id: string
    x: number
    y: number
    views: SavedView[]
  } | null>(null)
  const show = (id: string, view: HostOperation) => {
    setOpening(null)
    store.applyOperations([view, { kind: 'selection.set', value: [{ kind: 'concept', id }] }])
    focusConcept(id)
  }
  const open = (id: string, point: { x: number; y: number }) => {
    const views = store
      .getState()
      .workspace.savedViews.filter(({ members }) => members.some((member) => member.id === id))
    if (views.length === 1) show(id, { kind: 'view.activate', id: views[0].id })
    else setOpening({ id, ...point, views })
  }
  const create = (id: string) => {
    const label = store.getState().graph.concepts.find((concept) => concept.id === id)?.label
    show(id, {
      kind: 'view.create',
      id: newIri(),
      name: label?.trim().slice(0, maxViewNameLength).trim() || defaultViewName,
      conceptIds: [id],
    })
  }

  return (
    <div key={epoch} {...surfaceProps} className="h-full w-full">
      {overview ? (
        <KnowledgeGraph
          ref={graph}
          store={store}
          layout={store.knowledgeGraphLayout}
          readOnly={readOnly}
          focusRef={target}
          onOpen={preview ? undefined : open}
        />
      ) : (
        <ConceptMap
          ref={map}
          store={store}
          commands={rendererCommands}
          readOnly={readOnly}
          preview={preview}
          connection={connection}
          bottomInset={bottomInset}
          focusRef={target}
          conceptLabelMaxLength={maxConceptLabelLength}
          restoreViewport={restoreViewport}
          onPresentation={preview ? undefined : store.setConceptMapPresentation}
        />
      )}
      <OpenViewMenu
        target={opening}
        onClose={() => setOpening(null)}
        onOpen={(viewId) => opening && show(opening.id, { kind: 'view.activate', id: viewId })}
        onCreate={() => opening && create(opening.id)}
        finalFocus={target}
      />
    </div>
  )
}
