import type { Notification, NotificationAction, Notifications } from '@nesso-how/core'

type HostNotification = Notification & { readonly action?: NotificationAction }

export function createNotifications() {
  let items: readonly (HostNotification & { readonly id: string })[] = []
  const listeners = new Set<() => void>()
  const publish = (next: typeof items) => {
    items = next
    for (const listener of listeners) listener()
  }
  const api = {
    notify: (notification: HostNotification) => {
      const id = crypto.randomUUID()
      const item =
        notification.tone === 'confirmation'
          ? {
              ...notification,
              id,
              action: { ...notification.action },
              cancelAction: { ...notification.cancelAction },
            }
          : {
              ...notification,
              id,
              ...(notification.action ? { action: { ...notification.action } } : {}),
            }
      publish([...items, item])
      return id
    },
    dismiss: (id: string) => {
      const next = items.filter((item) => item.id !== id)
      if (next.length !== items.length) publish(next)
    },
  } satisfies Notifications
  return {
    api,
    getSnapshot: () => items,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
