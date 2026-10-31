import type { Ref } from 'react'
import { defaultLocale } from '@nesso-how/i18n'
import { Kbd } from '@nesso-how/ui'
import { conceptMapShortcuts } from '@nesso-how/concept-map'
import { useNessoStore } from '@/store'
import { useTranslation } from '@/i18n'

const keyNames: Record<string, string> = { '⌘': 'Command', '⇧': 'Shift' }

type ShortcutSection = {
  readonly id: string
  readonly title: string
  readonly rows: readonly {
    readonly label: string
    readonly keys: readonly (readonly string[])[]
  }[]
}

export function ShortcutSettings({ titleRef }: { titleRef: Ref<HTMLHeadingElement> }) {
  const t = useTranslation()
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const mac = /Mac|iPhone|iPad/.test(navigator.platform)
  const modifier = mac ? '⌘' : 'Ctrl'
  const shift = mac ? '⇧' : 'Shift'
  const groups: readonly ShortcutSection[] = [
    {
      id: 'general',
      title: t('general'),
      rows: [{ label: t('shortcutOpenShortcuts'), keys: [['?']] }],
    },
    {
      id: 'shortcutsEditing',
      title: t('shortcutsEditing'),
      rows: [
        { label: t('shortcutAddConcept'), keys: [[modifier, 'Enter']] },
        { label: t('shortcutUndo'), keys: [[modifier, 'Z']] },
        {
          label: t('shortcutRedo'),
          keys: mac
            ? [[shift, modifier, 'Z']]
            : [
                [modifier, 'Y'],
                [modifier, shift, 'Z'],
              ],
        },
        { label: t('shortcutCopy'), keys: [[modifier, 'C']] },
        { label: t('shortcutCut'), keys: [[modifier, 'X']] },
        { label: t('shortcutPaste'), keys: [[modifier, 'V']] },
        { label: t('shortcutDelete'), keys: [['Backspace'], ['Delete']] },
      ],
    },
    {
      id: 'selection',
      title: t('selection'),
      rows: [
        { label: t('shortcutSelectAll'), keys: [[modifier, 'A']] },
        { label: t('shortcutClearSelection'), keys: [['Esc']] },
      ],
    },
    {
      id: 'notes',
      title: t('notes'),
      rows: [
        { label: t('shortcutNotesBold'), keys: [[modifier, 'B']] },
        { label: t('shortcutNotesItalic'), keys: [[modifier, 'I']] },
        { label: t('shortcutNotesIndent'), keys: [['Tab']] },
        { label: t('shortcutNotesOutdent'), keys: [[shift, 'Tab']] },
        { label: t('shortcutNotesLineBreak'), keys: [[shift, 'Enter']] },
        { label: t('shortcutNotesOpenLink'), keys: [[modifier, t('shortcutClick')]] },
      ],
    },
    { id: 'concept-map', ...conceptMapShortcuts(locale) },
  ]

  return (
    <>
      <h2 ref={titleRef} tabIndex={-1} className="settings-page-title outline-none">
        {t('shortcuts')}
      </h2>
      <p className="settings-page-description">{t('shortcutsDescription')}</p>
      {groups.map(({ id, title, rows }, index) => (
        <section
          key={id}
          className={`settings-section${index === 0 ? ' settings-section-first' : ''}`}
          aria-labelledby={`settings-${id}`}
        >
          <h3 id={`settings-${id}`} className="settings-section-title">
            {title}
          </h3>
          <dl className="mt-2">
            {rows.map(({ label, keys }) => (
              <div
                key={label}
                className="flex min-h-8 items-center justify-between gap-4 py-1 text-xs"
              >
                <dt>{label}</dt>
                <dd className="flex max-w-[60%] flex-wrap items-center justify-end gap-x-2 gap-y-1">
                  {keys.map((combination, index) => (
                    <span key={combination.join('+')} className="inline-flex items-center gap-1">
                      {index > 0 && (
                        <span className="mr-1 text-[10px] text-muted-foreground">
                          {t('shortcutOr')}
                        </span>
                      )}
                      {combination.map((key) => (
                        <Kbd key={key} aria-label={keyNames[key]}>
                          {key}
                        </Kbd>
                      ))}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </>
  )
}
