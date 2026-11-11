import { useState, type ReactNode, type RefObject } from 'react'
import { defaultLocale } from '@nesso-how/i18n'
import { resolveRelationTypeLabel } from '@nesso-how/core'
import { Button, ConfirmDialog } from '@nesso-how/ui'
import { ArrowLeft, Check, ExternalLink } from 'lucide-react'
import type { NpmPlugin, PluginAccess as Access } from '../../../shared/plugins.ts'
import {
  pluginMetadata,
  removeExternalPlugin,
  setPluginEnabled,
  stopActionsForPlugin,
  usePluginActionsRunning,
} from '@/plugins'
import { isLocalPlugin, type PluginEntry } from '@/plugins/registry'
import type { createPluginInstaller } from '@/plugins/installer'
import { translate } from '@/i18n'
import { notifications } from '@/notifications'
import { host, useNessoStore } from '@/store'
import { PluginAccess } from './PluginAccess'
import { PluginKindIcon } from './PluginRow'
import { isAllowedPluginLink } from '../../../shared/link-policy.ts'

type Installation = ReturnType<ReturnType<typeof createPluginInstaller>['getSnapshot']>
type LifecycleAction = 'enable' | 'disable' | 'stop' | 'remove'
type Props = {
  installed?: PluginEntry
  target?: NpmPlugin
  titleRef: RefObject<HTMLHeadingElement | null>
  back: string
  checking: boolean
  installation: Installation
  onBack: () => void
  onStart: (target: NpmPlugin) => void
  onCheck: () => void
  onCancel: () => void
  onLifecycle: (action: LifecycleAction) => void
}

function PackageAttribution({
  info,
  npm,
}: {
  info: Pick<NpmPlugin, 'name' | 'author' | 'repository'>
  npm: boolean
}) {
  const t = translate(useNessoStore((state) => state.preferences.locale ?? defaultLocale))
  const links = [
    ...(npm
      ? [
          {
            label: t('pluginViewNpm'),
            url: `https://www.npmjs.com/package/${info.name}`,
          },
        ]
      : []),
    ...(info.repository ? [{ label: t('pluginSourceGitHub'), url: info.repository }] : []),
  ].filter(({ url }) => isAllowedPluginLink(url))
  if (!info.author && !links.length) return null
  return (
    <div className="plugin-attribution mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
      {info.author && (
        <span className="max-w-full break-words">{t('pluginAuthor', { author: info.author })}</span>
      )}
      {links.map(({ label, url }) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
        >
          {label}
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      ))}
    </div>
  )
}

function DeclaredAccess({ access }: { access: Access }) {
  const t = translate(useNessoStore((state) => state.preferences.locale ?? defaultLocale))
  return (
    <section className="settings-section">
      <h3 className="settings-section-title mb-3">{t('pluginDeclaredAccess')}</h3>
      <PluginAccess access={access} />
    </section>
  )
}

function Contributions({ entry }: { entry: PluginEntry }) {
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const t = translate(locale)
  if (entry.kind === 'actions' && entry.contribution.length)
    return (
      <section className="settings-section">
        <h3 className="settings-section-title">{t('commands')}</h3>
        <ul className="mt-3 space-y-2">
          {entry.contribution.map((action) => (
            <li key={action.id} className="flex items-center gap-2 text-xs">
              <Check className="size-3 text-muted-foreground" aria-hidden="true" />
              {action.label[locale] ?? action.label.en}
            </li>
          ))}
        </ul>
      </section>
    )
  const vocab = entry.kind === 'vocab' ? entry.contribution : undefined
  if (vocab)
    return (
      <section className="settings-section">
        <h3 className="settings-section-title">{t('vocab')}</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {vocab.relationTypes.map((type) => (
            <span className="settings-badge" key={type.id}>
              {resolveRelationTypeLabel(type, [vocab], locale)}
            </span>
          ))}
        </div>
      </section>
    )
  return null
}

function InstallControl({
  installed,
  target,
  checking,
  installation,
  onStart,
  onCheck,
  onCancel,
}: Pick<
  Props,
  'installed' | 'target' | 'checking' | 'installation' | 'onStart' | 'onCheck' | 'onCancel'
>) {
  const t = translate(useNessoStore((state) => state.preferences.locale ?? defaultLocale))
  const active = installation.attempt?.name === (target?.name ?? installed?.id)
  if (active)
    return (
      <>
        <Button size="sm" disabled>
          {t(installed ? 'pluginUpdating' : 'pluginInstalling')}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t('cancel')}
        </Button>
      </>
    )
  if (target)
    return (
      <Button size="sm" disabled={installation.running} onClick={() => onStart(target)}>
        {t(installed ? 'pluginUpdateAction' : 'pluginInstall')}
      </Button>
    )
  if (!installed?.contentId || isLocalPlugin(installed)) return null
  const updated = installation.updated === `${installed.id}@${installed.version}`
  return (
    <Button
      size="sm"
      variant={updated ? 'default' : 'outline'}
      disabled={installation.running || checking || updated}
      onClick={onCheck}
    >
      {t(updated ? 'pluginUpdated' : checking ? 'pluginChecking' : 'pluginCheckUpdates')}
    </Button>
  )
}

function UseControl({ entry }: { entry: PluginEntry }) {
  const preferences = useNessoStore((state) => state.preferences)
  const locale = preferences.locale ?? defaultLocale
  const t = translate(locale)
  if (entry.kind === 'actions' || !entry.contribution || entry.disabled || entry.error) return null
  const id = entry.contribution.id
  const key = entry.kind === 'theme' ? 'activeThemeId' : 'activeVocabId'
  const select = entry.kind === 'theme' ? host.store.setActiveTheme : host.store.setActiveVocab
  const activate = () => {
    const previous = host.store.getState().preferences[key]
    if (previous === id) return
    select(id)
    notifications.api.notify({
      tone: 'info',
      title: t(entry.kind === 'theme' ? 'pluginThemeChanged' : 'pluginVocabChanged'),
      description: t(
        entry.kind === 'theme' ? 'pluginThemeChangedDescription' : 'pluginVocabChangedDescription',
        { name: pluginMetadata(entry, locale).name },
      ),
      action: {
        label: t('shortcutUndo'),
        onClick: () => {
          const state = host.store.getState()
          const available =
            entry.kind === 'theme'
              ? !!host.getTheme(previous)
              : state.vocabs.some(({ id }) => id === previous)
          if (state.preferences[key] !== id || !available) {
            notifications.api.notify({
              tone: 'warning',
              title: t('pluginUseUndoUnavailable'),
              description: t('pluginUseUndoUnavailableDescription'),
            })
            return
          }
          select(previous)
        },
      },
    })
  }
  return (
    <Button size="sm" disabled={preferences[key] === id} onClick={activate}>
      {t('pluginUse')}
    </Button>
  )
}

function LifecycleControls({
  entry,
  installation,
  onCancel,
  onLifecycle,
}: {
  entry: PluginEntry
  installation: Installation
  onCancel: () => void
  onLifecycle: (action: LifecycleAction) => void
}) {
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const running = usePluginActionsRunning(entry.id)
  const t = translate(locale)
  const [confirming, setConfirming] = useState<'disable' | 'remove'>()
  const [working, setWorking] = useState(false)
  const run = async (action: LifecycleAction) => {
    if (working) return
    setWorking(true)
    setConfirming(undefined)
    if (
      (action === 'disable' || action === 'remove') &&
      entry.contentId &&
      installation.attempt?.replacing === entry.contentId
    )
      onCancel()
    try {
      if (action === 'stop') {
        stopActionsForPlugin(entry.id)
        onLifecycle(action)
        return
      }
      const success =
        action === 'remove'
          ? entry.contentId && (await removeExternalPlugin(entry.contentId))
          : await setPluginEnabled(entry, action === 'enable')
      if (success) {
        if (action === 'remove')
          notifications.api.notify({
            tone: 'info',
            title: t('pluginRemoveDone'),
            description: t('pluginRemoveDoneDescription', {
              name: pluginMetadata(entry, locale).name,
            }),
          })
        onLifecycle(action)
      }
    } finally {
      setWorking(false)
    }
  }
  return (
    <>
      {!entry.error && (
        <Button
          size="sm"
          variant="outline"
          disabled={working}
          onClick={() => (entry.disabled ? void run('enable') : setConfirming('disable'))}
        >
          {t(entry.disabled ? 'pluginEnable' : 'pluginDisable')}
        </Button>
      )}
      {running && (
        <Button size="sm" variant="ghost" disabled={working} onClick={() => void run('stop')}>
          {t('pluginStop')}
        </Button>
      )}
      {entry.contentId && (
        <Button
          size="sm"
          variant="ghost"
          disabled={working}
          onClick={() => setConfirming('remove')}
        >
          {t('pluginRemove')}
        </Button>
      )}
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => {
          if (!open) setConfirming(undefined)
        }}
        title={t(confirming === 'remove' ? 'pluginRemoveTitle' : 'pluginDisableTitle')}
        description={t('pluginLifecycleDescription')}
        cancelLabel={t('cancel')}
        confirmLabel={t(confirming === 'remove' ? 'pluginRemove' : 'pluginDisable')}
        onConfirm={() => {
          if (confirming) void run(confirming)
        }}
      />
    </>
  )
}

function detailModel(
  installed: PluginEntry | undefined,
  target: NpmPlugin | undefined,
  preferences: { activeThemeId: string; activeVocabId: string },
  installation: Installation,
) {
  const info = target
    ? { ...target, kind: target.nesso.kind }
    : installed && { ...installed, name: installed.id }
  if (!info) return undefined
  const access = target?.nesso ?? installed?.access
  const active = installation.attempt?.name === info.name ? installation.attempt : undefined
  const inUse =
    !!installed &&
    installed.kind !== 'actions' &&
    installed.contribution?.id ===
      (installed.kind === 'theme' ? preferences.activeThemeId : preferences.activeVocabId)
  const useAvailable =
    !!installed &&
    installed.kind !== 'actions' &&
    !!installed.contribution &&
    !installed.disabled &&
    !installed.error
  return { info, access, active, inUse, useAvailable }
}

type DetailModel = NonNullable<ReturnType<typeof detailModel>>

function DetailHeader({
  titleRef,
  back,
  onBack,
  kind,
  title,
  version,
  status,
  local,
  inUse,
}: {
  titleRef: RefObject<HTMLHeadingElement | null>
  back: string
  onBack: () => void
  kind: DetailModel['info']['kind']
  title: string
  version: string
  status: string
  local: boolean
  inUse: boolean
}) {
  const t = translate(useNessoStore((state) => state.preferences.locale ?? defaultLocale))
  return (
    <>
      <Button variant="ghost" className="ai-back" onClick={onBack}>
        <ArrowLeft />
        {t(back === 'plugin-find' ? 'pluginFind' : 'pluginInstalled')}
      </Button>
      <div className="flex items-start gap-3">
        <PluginKindIcon kind={kind} label={t(kind)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 ref={titleRef} tabIndex={-1} className="settings-page-title outline-none">
              {title}
            </h2>
            <div className="flex flex-wrap justify-end gap-1">
              <span className="settings-badge">{status}</span>
              {local && <span className="settings-badge">{t('pluginLocal')}</span>}
              {inUse && <span className="settings-badge">{t('inUse')}</span>}
            </div>
          </div>
          <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">{version}</p>
        </div>
      </div>
    </>
  )
}

function DetailBody({
  installed,
  target,
  info,
  access,
  active,
}: {
  installed?: PluginEntry
  target?: NpmPlugin
  info: DetailModel['info']
  access?: DetailModel['access']
  active?: DetailModel['active']
}) {
  const locale = useNessoStore((state) => state.preferences.locale ?? defaultLocale)
  const t = translate(locale)
  const metadata = pluginMetadata(info, locale)
  return (
    <>
      <p className="settings-page-description">{metadata.description}</p>
      <PackageAttribution info={info} npm={!!target || !!installed?.npmIntegrity} />
      {installed?.error && (
        <p className="mt-5 rounded border p-3 text-xs leading-5" role="status">
          {t('pluginUnavailableDescription')}
        </p>
      )}
      {active && (
        <p className="mt-5 text-xs text-muted-foreground" role="status">
          {t(active.installing ? 'pluginValidating' : 'pluginInstalling')}
        </p>
      )}
      {installed && !target && <Contributions entry={installed} />}
      <section className="settings-section">
        <h3 className="settings-section-title">{t('documentation')}</h3>
        <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
          {metadata.documentation}
        </p>
      </section>
      {info.kind === 'actions' && access && <DeclaredAccess access={access} />}
      {installed?.contentId && (
        <section className="settings-section">
          <h3 className="settings-section-title">{t('pluginContentIdentity')}</h3>
          <p className="mt-3 break-all font-mono text-[10px] text-muted-foreground">
            SHA-256 {installed.contentId}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{t('pluginHashHint')}</p>
        </section>
      )}
    </>
  )
}

function DetailFooter({
  installed,
  target,
  installation,
  useAvailable,
  onCancel,
  onLifecycle,
  controls,
}: Pick<Props, 'installed' | 'target' | 'installation' | 'onCancel' | 'onLifecycle'> & {
  useAvailable: boolean
  controls: ReactNode
}) {
  const lifecycleAvailable = !!installed && (!!installed.contentId || installed.kind === 'actions')
  if (!useAvailable && !lifecycleAvailable && !(target && window.nessoPlugins)) return null
  return (
    <footer className="plugin-detail-footer">
      <div className="flex flex-wrap gap-1">
        {useAvailable && installed && <UseControl entry={installed} />}
        {lifecycleAvailable && installed && (
          <LifecycleControls
            entry={installed}
            installation={installation}
            onCancel={onCancel}
            onLifecycle={onLifecycle}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">{controls}</div>
    </footer>
  )
}

export function PluginDetails(props: Props) {
  const { installed, target, titleRef, back, installation, onBack } = props
  const preferences = useNessoStore((state) => state.preferences)
  const locale = preferences.locale ?? defaultLocale
  const t = translate(locale)
  const model = detailModel(installed, target, preferences, installation)
  if (!model) return null
  const { info, access, active, inUse, useAvailable } = model
  const metadata = pluginMetadata(info, locale)
  return (
    <>
      <div className="plugin-scroll nesso-scroll">
        <DetailHeader
          titleRef={titleRef}
          back={back}
          onBack={onBack}
          kind={info.kind}
          title={metadata.name}
          version={`${info.name}@${info.version}`}
          status={t(
            installed
              ? installed.disabled
                ? 'pluginDisabled'
                : installed.error
                  ? 'pluginUnavailable'
                  : 'pluginEnabled'
              : 'pluginNotInstalled',
          )}
          local={!!installed && isLocalPlugin(installed)}
          inUse={inUse}
        />
        <DetailBody
          installed={installed}
          target={target}
          info={info}
          access={access}
          active={active}
        />
      </div>
      <DetailFooter
        installed={installed}
        target={target}
        installation={installation}
        useAvailable={useAvailable}
        onCancel={props.onCancel}
        onLifecycle={props.onLifecycle}
        controls={!installed?.error && <InstallControl {...props} />}
      />
    </>
  )
}
