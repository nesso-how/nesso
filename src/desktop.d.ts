import type { UpdateBridge } from '../electron/updates'
import type { AiBridge } from '../electron/ai-contract'

declare global {
  interface Window {
    nessoUpdater?: UpdateBridge
    nessoAi?: AiBridge
  }
}
