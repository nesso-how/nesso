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
import { conceptNode, conceptNodeMinSize, indexGraph, relationEdge } from './adapters'
import { StoreContext, type ConceptMapContext } from './store'
import { ConceptMapImageError } from './image-bounds'

const nodeTypes = { concept: ConceptNodeView }
type ImageProps = { store: ConceptMapContext['store']; ready: () => void }

function ImageFlow({ store, ready }: ImageProps) {
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
    nodes.map(({ id, measured }) => [
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
  const edges = state.viewGraph.relations.map((relation) =>
    relationEdge(relation, false, false, initial.indexed, defaultTypeId, sizes),
  )
  useEffect(() => {
    if (initialized && nodes.every(({ measured }) => measured?.width && measured.height)) ready()
  }, [initialized, nodes, ready])
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
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

export function ImageCanvas({ store, ready }: ImageProps) {
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
        <ImageFlow store={store} ready={ready} />
      </ReactFlowProvider>
    </StoreContext.Provider>
  )
}
