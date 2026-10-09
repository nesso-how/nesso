import type { UpdateBridge } from '../electron/updates'
import type { AiBridge } from '../electron/ai-bridge'
import type { McpBridge } from '../electron/mcp-bridge'

declare global {
  interface Window {
    nessoUpdater?: UpdateBridge
    nessoAi?: AiBridge
    nessoMcp?: McpBridge
  }
}
