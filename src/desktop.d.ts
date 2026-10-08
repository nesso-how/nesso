import type { UpdateBridge } from '../electron/updates'

declare global {
  interface Window {
    nessoUpdater?: UpdateBridge
  }
}
