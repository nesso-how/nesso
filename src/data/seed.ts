import type { Locale } from '@nesso-how/i18n'
import type { WorkspaceState } from '@nesso-how/plugin'
import { parseGraph, type Graph } from '@nesso-how/schema'
import seed from './seed-graph.json' with { type: 'json' }
import seedViews from './seed-views.json' with { type: 'json' }
import it from './seed-translations/it.json' with { type: 'json' }
import zhCN from './seed-translations/zh-CN.json' with { type: 'json' }

type SeedTranslation = Readonly<{
  conceptLabels: Readonly<Record<string, string>>
  conceptDescriptions: Readonly<Record<string, string>>
  relationTypeLabels: Readonly<Record<string, string>>
  viewNames: Readonly<Record<string, string>>
}>

const translations: Readonly<Partial<Record<Locale, SeedTranslation>>> = { it, 'zh-CN': zhCN }

export function createSeedDocument(locale: Locale): { graph: Graph; workspace: WorkspaceState } {
  const graph = parseGraph(seed)
  const translation = translations[locale]
  return {
    graph: {
      ...graph,
      concepts: graph.concepts.map((concept) => ({
        ...concept,
        label: translation?.conceptLabels[concept.id] ?? concept.label,
        description: translation?.conceptDescriptions[concept.id] ?? concept.description,
      })),
      relationTypes: graph.relationTypes.map((type) => ({ ...type, label: translation?.relationTypeLabels[type.id] ?? type.label })),
    },
    workspace: {
      activeViewId: null,
      savedViews: seedViews.map((view) => ({ ...view, name: translation?.viewNames[view.id] ?? view.name, conceptIds: [...view.conceptIds] })),
      viewports: {},
    },
  }
}
