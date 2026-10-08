import type { UpdateBridge } from '../electron/updates'
import type { AiBridge } from '../electron/ai-bridge'

declare global {
  interface Window {
    nessoUpdater?: UpdateBridge
    nessoAi?: AiBridge
  }
}
