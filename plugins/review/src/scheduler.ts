import {
  DefaultScheduler,
  type DefaultSchedulerCard,
  type DefaultSchedulerRevlog,
  type Grade,
} from 'ts-fsrs'
import { z } from 'zod'
import { PluginError, type ActionContext } from '@nesso-how/plugin'

type Progress = {
  readonly model: 'FSRS-6'
  readonly card: DefaultSchedulerCard<'FSRS-6'>
  readonly logs: readonly DefaultSchedulerRevlog<'FSRS-6'>[]
}
type Session = {
  readonly ids: readonly string[]
  readonly index: number
  readonly revealed: boolean
}
type Snapshot = {
  readonly progress: ReadonlyMap<string, Progress>
  readonly session: Session | null
  readonly outcome: { readonly reviewed: number; readonly complete: boolean } | null
  readonly busy: boolean
  readonly failed: boolean
}

const dates = {
  dueAt: z.iso.datetime().transform((value) => new Date(value)),
  lastReviewAt: z.iso
    .datetime()
    .transform((value) => new Date(value))
    .nullable(),
}
const fields = {
  ...dates,
  stability: z.number().nonnegative(),
  difficulty: z.number().min(0).max(10),
  state: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  scheduleStatus: z.enum(['new', 'learning', 'review']),
  cardId: z.string(),
  scheduledDays: z.number().int().nonnegative(),
  learningStep: z.number().int().nonnegative(),
}
const storedProgress = z.strictObject({
  model: z.literal('FSRS-6'),
  card: z.strictObject({
    ...fields,
    reps: z.number().int().nonnegative(),
    lapses: z.number().int().nonnegative(),
  }),
  logs: z.array(
    z.strictObject({
      ...fields,
      rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      reviewTime: z.iso.datetime().transform((value) => new Date(value)),
    }),
  ),
})
const storageKey = 'progress'

export async function createReview(
  storage: ActionContext['storage'],
  now: () => Date = () => new Date(),
) {
  const scheduler = await DefaultScheduler({
    version: 'FSRS-6',
    desiredRetention: 0.9,
    enableShortTerm: true,
    learningSteps: ['1m', '10m'],
    relearningSteps: ['10m'],
    enableFuzz: false,
    maximumInterval: 36500,
  })
  const progress = new Map<string, Progress>()
  for (const record of await storage.list()) {
    if (record.key !== storageKey) continue
    try {
      if (!record.conceptId) throw new PluginError('invalid-input', [])
      const value = storedProgress.parse(record.value)
      const { card, logs } = value
      if (
        card.cardId !== record.conceptId ||
        card.reps !== logs.length ||
        logs.some((log) => log.cardId !== record.conceptId)
      )
        throw new PluginError('invalid-input', [])
      progress.set(record.conceptId, value)
    } catch {
      throw new PluginError('invalid-input', [
        { path: 'progress', message: 'Review progress could not be restored safely' },
      ])
    }
  }
  let snapshot: Snapshot = {
    progress,
    session: null,
    outcome: null,
    busy: false,
    failed: false,
  }
  let scope: readonly string[] = []
  const listeners = new Set<() => void>()
  const publish = (patch: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners) listener()
  }
  const due = (ids = scope, time = now()) =>
    [...new Set(ids)]
      .filter((id) => !snapshot.progress.has(id) || snapshot.progress.get(id)!.card.dueAt <= time)
      .sort(
        (a, b) =>
          (snapshot.progress.get(a)?.card.dueAt.getTime() ?? -Infinity) -
          (snapshot.progress.get(b)?.card.dueAt.getTime() ?? -Infinity),
      )
  const card = (id: string, time = now()) =>
    snapshot.progress.get(id)?.card ?? scheduler.newCard({ now: time, cardId: id })
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    due,
    setScope(ids: readonly string[]) {
      scope = [...new Set(ids)]
      const session = snapshot.session
      if (!session || snapshot.busy) return
      const remaining = session.ids.slice(session.index).filter((id) => scope.includes(id))
      if (remaining.length === session.ids.length - session.index) return
      publish({
        session: remaining.length
          ? {
              ...session,
              ids: [...session.ids.slice(0, session.index), ...remaining],
              revealed: false,
            }
          : null,
        outcome: remaining.length ? null : { reviewed: session.index, complete: false },
      })
    },
    start() {
      const ids = due()
      if (!ids.length || snapshot.busy || snapshot.failed) return
      publish({ session: { ids, index: 0, revealed: false }, outcome: null })
    },
    reveal() {
      if (snapshot.session && !snapshot.busy && !snapshot.failed)
        publish({ session: { ...snapshot.session, revealed: true } })
    },
    finish() {
      if (snapshot.busy || !snapshot.session) return
      publish({ session: null, outcome: { reviewed: snapshot.session.index, complete: false } })
    },
    preview(id: string, time = now()) {
      return [...scheduler.preview({ card: card(id, time), now: time })]
    },
    async rate(grade: Grade) {
      const session = snapshot.session
      if (!session?.revealed || snapshot.busy || snapshot.failed) return
      const id = session.ids[session.index]
      if (!scope.includes(id)) return
      publish({ busy: true })
      try {
        const time = now()
        const result = scheduler.review({ card: card(id, time), now: time, grade })
        const next: Progress = {
          model: 'FSRS-6',
          card: result.card,
          logs: [...(snapshot.progress.get(id)?.logs ?? []), result.revlog],
        }
        await storage.set(storageKey, JSON.parse(JSON.stringify(next)), id)
        const progress = new Map(snapshot.progress).set(id, next)
        const remaining = session.ids.slice(session.index + 1).filter((id) => scope.includes(id))
        const reviewed = session.index + 1
        publish({
          progress,
          busy: false,
          session: remaining.length
            ? {
                ids: [...session.ids.slice(0, session.index + 1), ...remaining],
                index: reviewed,
                revealed: false,
              }
            : null,
          outcome: remaining.length
            ? null
            : { reviewed, complete: session.index + 1 === session.ids.length },
        })
      } catch {
        publish({ busy: false, failed: true })
      }
    },
  }
}

export type Review = Awaited<ReturnType<typeof createReview>>
