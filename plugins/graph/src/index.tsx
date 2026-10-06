import type { Plugin } from '@nesso/plugin'
import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './Canvas'
import { StoreContext } from './store'

export const graphPlugin: Plugin = {
  operations: [
    'concept.position', 'concept.positions', 'concept.add', 'concept.remove',
    'relation.connect', 'relation.remove', 'selection.set', 'viewport.set',
  ],
  create: ({ store }) => ({
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
  }),
}
