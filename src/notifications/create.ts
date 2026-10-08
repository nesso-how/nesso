import type { Notification, Notifications } from '@nesso/plugin'

export function createNotifications() {
  let items: readonly (Notification & { readonly id: string })[] = []
  const listeners = new Set<() => void>()
  const publish = (next: typeof items) => {
    items = next
    for (const listener of listeners) listener()
  }
  const api: Notifications = {
    notify: (notification) => {
      const id = crypto.randomUUID()
      const item = notification.tone === 'confirmation'
        ? { ...notification, id, action: { ...notification.action }, cancelAction: { ...notification.cancelAction } }
        : { ...notification, id }
      publish([...items, item])
      return id
    },
    dismiss: (id) => {
      const next = items.filter((item) => item.id !== id)
      if (next.length !== items.length) publish(next)
    },
  }
  return {
    api,
    getSnapshot: () => items,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}
