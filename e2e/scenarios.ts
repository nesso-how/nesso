import type { CheckContext } from './helpers.ts'

export type Platform = 'desktop' | 'static-web'

type Scenario = {
  platforms: readonly Platform[]
  blank?: true
  args?: readonly string[]
  load: () => Promise<(context: CheckContext) => Promise<void>>
}

const all = ['desktop', 'static-web'] as const
const desktop = ['desktop'] as const

export const scenarios: Record<string, Scenario> = {
  worker: {
    platforms: all,
    blank: true,
    load: () => import('./plugins/worker.ts').then(({ verifyWorker }) => verifyWorker),
  },
  panel: {
    platforms: all,
    blank: true,
    load: () => import('./plugins/panel.ts').then(({ verifyPanel }) => verifyPanel),
  },
  notes: {
    platforms: all,
    blank: true,
    load: () => import('./plugins/notes.ts').then(({ verifyNotes }) => verifyNotes),
  },
  'panel-workspace': {
    platforms: desktop,
    load: () =>
      import('./app/panel-workspace.ts').then(({ verifyPanelWorkspace }) => verifyPanelWorkspace),
  },
  'busy-panel': {
    platforms: desktop,
    load: () => import('./plugins/busy-panel.ts').then(({ verifyBusyPanel }) => verifyBusyPanel),
  },
  bundled: {
    platforms: all,
    blank: true,
    load: () => import('./plugins/bundled.ts').then(({ verifyBundled }) => verifyBundled),
  },
  images: {
    platforms: all,
    load: () => import('./app/images.ts').then(({ verifyImages }) => verifyImages),
  },
  intro: {
    platforms: all,
    load: () => import('./app/intro.ts').then(({ verifyIntro }) => verifyIntro),
  },
  compact: {
    platforms: all,
    load: () => import('./app/compact.ts').then(({ verifyCompact }) => verifyCompact),
  },
  creation: {
    platforms: all,
    load: () => import('./app/creation.ts').then(({ verifyCreation }) => verifyCreation),
  },
  storage: {
    platforms: all,
    load: () => import('./app/storage.ts').then(({ verifyStorage }) => verifyStorage),
  },
  startup: {
    platforms: desktop,
    load: () => import('./app/startup.ts').then(({ verifyStartup }) => verifyStartup),
  },
  installation: {
    platforms: desktop,
    load: () =>
      import('./plugins/installation.ts').then(({ verifyInstallation }) => verifyInstallation),
  },
  'safe-plugins': {
    platforms: desktop,
    args: ['--safe-plugins'],
    load: () =>
      import('./plugins/safe-plugins.ts').then(({ verifySafePlugins }) => verifySafePlugins),
  },
  'corrupt-records': {
    platforms: desktop,
    load: () =>
      import('./plugins/corrupt-records.ts').then(
        ({ verifyCorruptRecords }) => verifyCorruptRecords,
      ),
  },
}
