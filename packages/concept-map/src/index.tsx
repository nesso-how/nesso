import { ReactFlowProvider } from '@xyflow/react'
import { memo, useSyncExternalStore } from 'react'
import { Canvas } from './Canvas'
import { StoreContext, type CanvasProps, type ConceptMapContext } from './store'

export { conceptMapShortcuts } from './shortcuts'
export type { ConceptMapHandle } from './store'

export const ConceptMap = memo(function ConceptMap({
  store,
  commands,
  connection,
  ...props
}: ConceptMapContext & CanvasProps) {
  const mapId = useSyncExternalStore(store.subscribe, () => store.getState().workspace.activeMapId)
  return (
    <StoreContext.Provider value={{ store, commands, connection }}>
      <ReactFlowProvider key={mapId}>
        <Canvas {...props} />
      </ReactFlowProvider>
    </StoreContext.Provider>
  )
})
