import { ColorPicker, presetColors } from '@nesso/ui'
import { useTranslation } from '@/i18n'
import { notifications } from '@/notifications'
import { nessoStore } from '@/store'
import type { HostState, HostStore } from '@/store/types'

export function ConceptColor({ store = nessoStore, concepts, readonly = false }: {
  store?: HostStore
  concepts: HostState['graph']['concepts']
  readonly?: boolean
}) {
  const t = useTranslation(store)
  const color = concepts[0]?.color
  const mixed = concepts.some((concept) => concept.color !== color)
  return (
    <ColorPicker
      value={mixed ? null : color}
      disabled={readonly}
      onValueChange={(value, interactionId) => {
        if (readonly) return
        store.applyOperations(
          concepts.map(({ id }) => ({ kind: 'concept.color', id, value: value ?? '' })),
          interactionId ? { historyGroup: interactionId } : undefined,
        )
      }}
      onCopyError={() => { notifications.api.notify({ tone: 'warning', title: t('copyColorFailed') }) }}
      inputProps={{ 'data-document-edit': true }}
      labels={{
        color: t('color'),
        chooseColor: t('chooseColor'),
        title: t('nodeBackgroundColor'),
        saturationBrightness: t('saturationBrightness'),
        saturationHint: t('saturationHint'),
        hue: t('hue'),
        colorPresets: t('colorPresets'),
        hex: t('hex'),
        copyColor: t('copyColor'),
        copied: t('copied'),
        colorInvalid: t('colorInvalid'),
        default: t('default'),
        mixed: t('mixed'),
        resetColor: t('resetColor'),
      }}
      presets={presetColors.map((preset) => ({ value: preset.value, label: t(preset.key) }))}
    />
  )
}
