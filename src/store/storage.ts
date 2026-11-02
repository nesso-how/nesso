import type {
  PersistenceBridge,
  PersistenceSection,
  PersistenceStorage,
} from '../../shared/persistence.ts'
import { NessoError } from '@nesso-how/errors'
import { persistenceSections } from '../../shared/persistence.ts'
import { createBackup } from './backup.ts'

export function createIndexedDbStorage(source: () => IDBFactory): PersistenceStorage {
  let database: Promise<IDBDatabase> | undefined
  const open = () =>
    (database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = source().open('nesso', 1)
      let blocked = false
      request.onupgradeneeded = () => {
        request.result.createObjectStore('records')
      }
      request.onerror = () => {
        database = undefined
        reject(request.error)
      }
      request.onblocked = () => {
        blocked = true
        reject(
          new NessoError([
            { path: 'storage', message: 'Database upgrade is blocked by another tab' },
          ]),
        )
      }
      request.onsuccess = () => {
        const db = request.result
        if (blocked) {
          db.close()
          database = undefined
          return
        }
        db.onversionchange = () => {
          db.close()
          database = undefined
        }
        resolve(db)
      }
    }))
  const transaction = async (
    section: PersistenceSection,
    value?: unknown,
    writing = false,
  ): Promise<unknown> => {
    const db = await open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('records', writing ? 'readwrite' : 'readonly')
      const records = tx.objectStore('records')
      const request = writing ? records.put(value, section) : records.get(section)
      tx.oncomplete = () => resolve(writing ? undefined : request.result)
      tx.onabort = () =>
        reject(
          tx.error ?? new NessoError([{ path: section, message: 'Storage transaction aborted' }]),
        )
    })
  }
  return {
    read: (section) => transaction(section),
    write: async (section, value) => {
      await transaction(section, value, true)
    },
    backup: async () => {
      const db = await open()
      const snapshot = await new Promise<Partial<Record<PersistenceSection, unknown>>>(
        (resolve, reject) => {
          const tx = db.transaction('records', 'readonly')
          const records = tx.objectStore('records')
          const snapshot: Partial<Record<PersistenceSection, unknown>> = {}
          for (const section of persistenceSections) {
            const request = records.get(section)
            request.onsuccess = () => {
              snapshot[section] = request.result
            }
          }
          tx.oncomplete = () => resolve(snapshot)
          tx.onabort = () => reject(tx.error)
        },
      )
      const text = await createBackup({ read: async (section) => snapshot[section] })
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('records', 'readwrite')
        tx.objectStore('records').add(JSON.parse(text), `backup:${crypto.randomUUID()}`)
        tx.oncomplete = () => resolve()
        tx.onabort = () => reject(tx.error)
      })
    },
  }
}

export function createDesktopStorage(bridge: PersistenceBridge): PersistenceStorage {
  return {
    read: async (section) => {
      const result = await bridge.read(section)
      if ('issues' in result) throw new NessoError(result.issues)
      return result.value
    },
    write: async (section, value) => {
      const result = await bridge.write(section, value)
      if ('issues' in result) throw new NessoError(result.issues)
    },
    backup: async () => {
      const result = await bridge.backup()
      if ('issues' in result) throw new NessoError(result.issues)
    },
  }
}
