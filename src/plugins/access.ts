import type { PluginAccess } from '../../shared/plugins.ts'
import type { translate } from '../i18n/index.ts'

const writes = {
  'concept.label': 'pluginAccessLabel',
  'concept.description': 'pluginAccessDescription',
  'concept.color': 'pluginAccessColor',
  'concept.bold': 'pluginAccessEmphasis',
  'concept.italic': 'pluginAccessEmphasis',
  'concept.position': 'pluginAccessPosition',
  'concept.positions': 'pluginAccessPositions',
  'concept.add': 'pluginAccessAdd',
  'concept.remove': 'pluginAccessRemove',
  'relation.connect': 'pluginAccessConnect',
  'relation.reconnect': 'pluginAccessReconnect',
  'relation.type': 'pluginAccessType',
  'relation.type.create': 'pluginAccessCreateType',
  'relation.remove': 'pluginAccessRemoveRelation',
  'selection.set': 'pluginAccessSelection',
  'view.membership': 'pluginAccessMembership',
} as const
const capabilities = {
  files: 'pluginAccessFiles',
  notifications: 'pluginAccessNotify',
  storage: 'pluginAccessStorage',
  ui: 'pluginAccessUI',
} as const

export const pluginAccessLabels = (access: PluginAccess, t: ReturnType<typeof translate>) => [
  ...new Set([
    ...access.writes.map((value) => t(writes[value])),
    ...access.capabilities.map((value) => t(capabilities[value])),
  ]),
]
