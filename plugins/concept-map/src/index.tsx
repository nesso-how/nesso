import type { Plugin, RendererProps } from '@nesso/plugin'
import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './Canvas'
import { StoreContext } from './store'
import { translate } from './i18n'

export const conceptMapPlugin: Extract<Plugin, { kind: 'renderer' }> = {
  kind: 'renderer',
  metadata: (locale) => ({
    name: translate(locale)('pluginName'),
    description: translate(locale)('pluginDescription'),
    documentation: translate(locale)('pluginDocumentation'),
  }),
  operations: [
    'concept.label', 'concept.description', 'concept.position', 'concept.positions', 'concept.add', 'concept.remove',
    'relation.connect', 'relation.reconnect', 'relation.remove', 'selection.set', 'viewport.set',
    'history.undo', 'history.redo',
  ],
  create: (context) => ({
    id: 'concept-map',
    component: function ConceptMapRenderer(props: RendererProps) {
      return (
        <StoreContext.Provider value={context}>
          <ReactFlowProvider>
            <Canvas {...props} />
          </ReactFlowProvider>
        </StoreContext.Provider>
      )
    },
  }),
}
