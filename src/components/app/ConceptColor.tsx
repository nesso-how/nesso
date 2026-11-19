import { useSyncExternalStore } from 'react'
import { colorPresets, type ColorPreset } from '@nesso-how/schema'
import { ColorPicker } from '@nesso-how/ui'
import { useTranslation } from '@/i18n'
import { notifications } from '@/notifications'
import { nessoStore } from '@/store'
import type { HostState, HostStore } from '@/store/types'

const presetLabels = {
  neutral: 'presetNeutral',
  sand: 'presetSand',
  peach: 'presetPeach',
  rose: 'presetRose',
  sage: 'presetSage',
  mint: 'presetMint',
  sky: 'presetSky',
  lavender: 'presetLavender',
} as const satisfies Record<ColorPreset, string>
const subscribeTheme = (change: () => void) => {
  const observer = new MutationObserver(change)
  observer.observe(document.documentElement, { attributeFilter: ['style'] })
  return () => observer.disconnect()
}
const themeStyle = () => document.documentElement.style.cssText

export function ConceptColor({
  store = nessoStore,
  concepts,
  readonly = false,
}: {
  store?: HostStore
  concepts: HostState['mapGraph']['concepts']
  readonly?: boolean
}) {
  const t = useTranslation(store)
  useSyncExternalStore(subscribeTheme, themeStyle)
  const style = document.documentElement.style
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
      onCopyError={() => {
        notifications.api.notify({ tone: 'warning', title: t('copyColorFailed') })
      }}
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
      presets={colorPresets.map((preset) => ({
        value: preset,
        label: t(presetLabels[preset]),
        color: style.getPropertyValue(`--preset-${preset}`),
      }))}
    />
  )
}
