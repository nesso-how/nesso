import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './Canvas'
import { StoreContext, type CanvasProps, type ConceptMapContext } from './store'

export function ConceptMap({ store, commands, ...props }: ConceptMapContext & CanvasProps) {
  return <StoreContext.Provider value={{ store, commands }}>
    <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>
  </StoreContext.Provider>
}
