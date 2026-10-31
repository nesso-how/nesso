import type { UpdateBridge } from '../electron/updates'
import type { AiBridge } from '../electron/ai-bridge'
import type { McpBridge } from '../electron/mcp-bridge'
import type { PersistenceBridge } from '../shared/persistence'
import type { DataLocationBridge } from '../shared/data-location'
import type { FileBridge } from '../shared/files'
import type { PluginBridge } from '../shared/plugins'
import type { NotesLinkBridge } from '../shared/link-policy'

declare global {
  interface Window {
    nessoUpdater?: UpdateBridge
    nessoAi?: AiBridge
    nessoMcp?: McpBridge
    nessoPersistence?: PersistenceBridge
    nessoDataLocation?: DataLocationBridge
    nessoFiles?: FileBridge
    nessoPlugins?: PluginBridge
    nessoNotesLinks?: NotesLinkBridge
  }
}
