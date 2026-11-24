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
import { KnowledgeGraph, type KnowledgeGraphHandle } from '@nesso-how/knowledge-graph'
import { newIri, type Position } from '@nesso-how/schema'
import { useGraphInteractions } from '../../graph/interactions.ts'
import type { HostOperation, HostStore } from '../../store/types.ts'
import { defaultMapName } from '../../store/operations.ts'
import { maxConceptLabelLength, maxMapNameLength } from '../../store/settings.ts'
import { OpenMapMenu } from './OpenMapMenu.tsx'

export function GraphWorkspace({
  ref,
  store,
  preview = false,
  readOnly: locked = false,
  connection,
  suspended = false,
  bottomInset = 0,
  onDeleteMap,
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
  onDeleteMap?: () => void
  onConfirmDelete?: () => void
  focusRef?: RefObject<HTMLDivElement | null>
}) {
  const activeMapId = useSyncExternalStore(
    store.subscribe,
    () => store.getState().workspace.activeMapId,
  )
  const inGraph = activeMapId === null
  const localFocus = useRef<HTMLDivElement>(null)
  const target = focusRef ?? localFocus
  const readOnly = preview || locked
  const { epoch, commands, surfaceProps } = useGraphInteractions(store, {
    readOnly: readOnly || suspended,
    preview,
    onDeleteMap,
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

  const map = useRef<ConceptMapHandle>(null)
  const graph = useRef<KnowledgeGraphHandle>(null)
  const pending = useRef<string | null>(null)
  useEffect(() => {
    const id = pending.current
    pending.current = null
    if (id !== null) (inGraph ? graph.current : map.current)?.focusConcept(id)
  }, [activeMapId, inGraph])
  const focusConcept = (id: string) => {
    if (store.getState().workspace.activeMapId !== activeMapId) pending.current = id
    else (inGraph ? graph.current : map.current)?.focusConcept(id)
  }
  useImperativeHandle(ref, () => ({
    focusConcept,
    addToMap: (id) => map.current?.addToMap(id),
  }))

  const [opening, setOpening] = useState<{
    id: string
    x: number
    y: number
  } | null>(null)
  const show = (id: string, activation: HostOperation) => {
    setOpening(null)
    store.applyOperations([activation, { kind: 'selection.set', value: [{ kind: 'concept', id }] }])
    focusConcept(id)
  }
  const open = (id: string, point: { x: number; y: number }) => {
    const maps = store
      .getState()
      .workspace.maps.filter(({ members }) => members.some((member) => member.id === id))
    if (maps.length === 1) show(id, { kind: 'map.activate', id: maps[0].id })
    else setOpening({ id, ...point })
  }
  const create = (id: string) => {
    const label = store.getState().graph.concepts.find((concept) => concept.id === id)?.label
    show(id, {
      kind: 'map.create',
      id: newIri(),
      name: label?.trim().slice(0, maxMapNameLength).trim() || defaultMapName,
      conceptIds: [id],
    })
  }

  return (
    <div key={epoch} {...surfaceProps} className="h-full w-full">
      {inGraph ? (
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
          onPresentation={preview ? undefined : store.setConceptMapPresentation}
        />
      )}
      <OpenMapMenu
        store={store}
        target={opening}
        onClose={() => setOpening(null)}
        onOpen={(mapId) => opening && show(opening.id, { kind: 'map.activate', id: mapId })}
        onCreate={() => opening && create(opening.id)}
        finalFocus={target}
      />
    </div>
  )
}
