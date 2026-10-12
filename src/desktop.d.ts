import type { UpdateBridge } from '../electron/updates'
import type { AiBridge } from '../electron/ai-bridge'
import type { McpBridge } from '../electron/mcp-bridge'
import type { PersistenceBridge } from '../shared/persistence'
import type { DataLocationBridge } from '../shared/data-location'

declare global {
  interface Window {
    nessoUpdater?: UpdateBridge
    nessoAi?: AiBridge
    nessoMcp?: McpBridge
    nessoPersistence?: PersistenceBridge
    nessoDataLocation?: DataLocationBridge
  }
}
