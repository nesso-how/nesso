import type { Plugin } from '@nesso/plugin'
import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './Canvas'
import { StoreContext } from './store'

export const graphPlugin: Plugin = ({ store }) => ({
  renderers: [{
    id: 'graph',
    label: 'Graph',
    component: function GraphRenderer() {
      return (
        <StoreContext.Provider value={store}>
          <ReactFlowProvider>
            <Canvas />
          </ReactFlowProvider>
        </StoreContext.Provider>
      )
    },
  }],
})
