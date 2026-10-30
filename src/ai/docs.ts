import type { AiDocumentation } from '@nesso-how/ai'
import nesso from '../../README.md?raw'
import ai from '../../packages/ai/README.md?raw'
import plugin from '../../packages/plugin/README.md?raw'
import pluginExample from '../../packages/plugin/example/README.md?raw'
import schema from '../../packages/schema/README.md?raw'
import conceptMap from '../../packages/concept-map/README.md?raw'
import ui from '../../packages/ui/README.md?raw'

export const documentation: AiDocumentation = {
  nesso, ai, plugin, 'plugin-example': pluginExample, schema, 'concept-map': conceptMap, ui,
}
