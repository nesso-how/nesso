import { ReactFlowProvider } from '@xyflow/react'
import { memo } from 'react'
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
  return (
    <StoreContext.Provider value={{ store, commands, connection }}>
      <ReactFlowProvider>
        <Canvas {...props} />
      </ReactFlowProvider>
    </StoreContext.Provider>
  )
})
