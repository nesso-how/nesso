import type { Plugin } from '@nesso/plugin'
import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './Canvas'
import { StoreContext } from './store'
import { translate } from './i18n'

export const conceptMapPlugin: Plugin = {
  kind: 'renderer',
  metadata: (locale) => ({
    name: translate(locale)('pluginName'),
    description: translate(locale)('pluginDescription'),
    documentation: translate(locale)('pluginDocumentation'),
  }),
  operations: [
    'concept.position', 'concept.positions', 'concept.add', 'concept.remove',
    'relation.connect', 'relation.reconnect', 'relation.remove', 'selection.set', 'viewport.set',
    'history.undo', 'history.redo',
  ],
  create: ({ store }) => ({
    id: 'concept-map',
    component: function ConceptMapRenderer() {
      return (
        <StoreContext.Provider value={store}>
          <ReactFlowProvider>
            <Canvas />
          </ReactFlowProvider>
        </StoreContext.Provider>
      )
    },
  }),
}
