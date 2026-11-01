import type { Locale } from '@nesso-how/i18n'
import type { RelationType } from '@nesso-how/schema'
import type { VocabDefinition } from './types.ts'

export function resolveRelationTypeLabel(
  type: Readonly<RelationType>,
  vocabs: readonly VocabDefinition[],
  locale: Locale,
): string {
  for (const vocab of vocabs) {
    const definition = vocab.relationTypes.find(
      (item) => item.id === type.id && item.label === type.label,
    )
    if (definition)
      return definition.translations?.[locale] ?? definition.translations?.en ?? type.label
  }
  return type.label
}
