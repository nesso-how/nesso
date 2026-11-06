import { useEffect, useMemo } from 'react'
import {
  ConnectionMode,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useNodesState,
} from '@xyflow/react'
import { defaultLocale } from '@nesso-how/i18n'
import { ConceptNodeView } from './ConceptNodeView'
import { GroupNodeView } from './GroupNodeView'
import { groupRelations } from './groups'
import { conceptNode, conceptNodeMinSize, createGraphElements, indexGraph } from './adapters'
import { StoreContext, type ConceptMapContext } from './store'
import type { ConceptMapPresentation } from './presentation'
import { ConceptMapImageError } from './image-bounds'

const nodeTypes = { concept: ConceptNodeView, relationGroup: GroupNodeView }
type ImageProps = {
  store: ConceptMapContext['store']
  ready: (edges: number) => void
  presentation?: ConceptMapPresentation
}

function ImageFlow({ store, ready, presentation }: ImageProps) {
  const state = store.getState()
  const initial = useMemo(
    () => ({
      nodes: state.viewGraph.concepts.map((concept) => conceptNode(concept, false)),
      indexed: indexGraph(state.viewGraph, state.vocabs, state.preferences.locale ?? defaultLocale),
    }),
    [state],
  )
  const [nodes, , onNodesChange] = useNodesState(initial.nodes)
  const initialized = useNodesInitialized()
  const sizes = Object.fromEntries(
    nodes
      .filter(({ measured }) => measured?.width && measured.height)
      .map(({ id, measured }) => [
        id,
        {
          width: measured?.width ?? conceptNodeMinSize.width,
          height: measured?.height ?? conceptNodeMinSize.height,
        },
      ]),
  )
  const defaultTypeId = state.vocabs.find(
    ({ id }) => id === state.preferences.activeVocabId,
  )?.defaultTypeId
  const adapt = useMemo(() => createGraphElements(), [])
  const groups = !(state.preferences.relationGroups ?? true)
    ? []
    : presentation?.graph === state.graph && presentation.viewId === state.workspace.activeViewId
      ? presentation.groups
      : groupRelations({
          concepts: state.viewGraph.concepts,
          relations: state.viewGraph.relations,
          sizes,
        })
  const elements = adapt({
    graph: state.viewGraph,
    indexed: initial.indexed,
    selected: [],
    sizes,
    defaultTypeId,
    groups,
    label: () => '',
  })
  useEffect(() => {
    if (initialized && nodes.every(({ measured }) => measured?.width && measured.height))
      ready(elements.edges.length)
  }, [initialized, nodes, ready, elements.edges.length])
  return (
    <ReactFlow
      nodes={elements.nodes}
      edges={elements.edges}
      nodeTypes={nodeTypes}
      connectionMode={ConnectionMode.Loose}
      onNodesChange={onNodesChange}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      onlyRenderVisibleElements={false}
      defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      proOptions={{ hideAttribution: true }}
    />
  )
}

export function ImageCanvas({ store, ready, presentation }: ImageProps) {
  const readOnly = () => {
    throw new ConceptMapImageError([{ path: 'image', message: 'Image rendering is read-only' }])
  }
  return (
    <StoreContext.Provider
      value={{
        store,
        commands: {
          deleteSelection: readOnly,
          copy: async () => readOnly(),
          paste: async () => readOnly(),
        },
      }}
    >
      <ReactFlowProvider>
        <ImageFlow store={store} ready={ready} presentation={presentation} />
      </ReactFlowProvider>
    </StoreContext.Provider>
  )
}
