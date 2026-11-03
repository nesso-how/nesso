import { z } from 'zod'
import { PluginError, type PluginStorage } from '@nesso-how/plugin'

const noteSchema = z.strictObject({ version: z.literal(1), text: z.string() })
type NotesSnapshot = { readonly text: string; readonly failed: boolean }

export async function createNotes(storage: PluginStorage, viewId: string | null) {
  const scope = viewId === null ? undefined : { kind: 'view' as const, id: viewId }
  const records = await storage.list()
  const record = records.find(
    (record) =>
      record.key === 'notes' &&
      (scope === undefined
        ? record.scope === undefined
        : record.scope?.kind === 'view' && record.scope.id === scope.id),
  )
  const parsed = record === undefined ? undefined : noteSchema.safeParse(record.value)
  if (parsed && !parsed.success)
    throw new PluginError('invalid-input', [
      { path: 'notes', message: 'Saved notes could not be restored safely' },
    ])
  let saved = parsed?.data?.text ?? ''
  let snapshot: NotesSnapshot = { text: saved, failed: false }
  let writing = false
  const listeners = new Set<() => void>()
  const publish = (next: NotesSnapshot) => {
    snapshot = next
    for (const listener of listeners) listener()
  }
  const save = async () => {
    if (writing || snapshot.failed) return
    writing = true
    try {
      while (saved !== snapshot.text) {
        const text = snapshot.text
        await storage.set('notes', { version: 1, text }, scope)
        saved = text
      }
    } catch {
      publish({ ...snapshot, failed: true })
    } finally {
      writing = false
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setText: (text: string) => {
      if (snapshot.failed || snapshot.text === text) return
      publish({ text, failed: false })
      void save()
    },
  }
}

export type Notes = Awaited<ReturnType<typeof createNotes>>
