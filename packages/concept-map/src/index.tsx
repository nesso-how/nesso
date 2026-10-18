import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './Canvas'
import { StoreContext, type CanvasProps, type ConceptMapContext } from './store'

export function ConceptMap({ store, notifications, clipboard, ...props }: ConceptMapContext & CanvasProps) {
  return <StoreContext.Provider value={{ store, notifications, clipboard }}>
    <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>
  </StoreContext.Provider>
}
