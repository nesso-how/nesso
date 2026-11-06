import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, DialogActions, DialogPopup } from '@nesso-how/ui'
import type { PluginApproval, PluginBridge } from '../../../shared/plugins.ts'
import { useTranslation } from '@/i18n'
import { pluginAccessGroups } from '@/plugins/access'

export function PluginApprovalDialog({ bridge }: { bridge: PluginBridge }) {
  const t = useTranslation()
  const [approval, setApproval] = useState<PluginApproval>()
  const [working, setWorking] = useState(false)
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(
    () =>
      bridge.subscribe((event) => {
        if (event.type === 'approval') {
          setWorking(false)
          setApproval(event.approval)
        } else setApproval((current) => (current?.id === event.id ? undefined : current))
      }),
    [bridge],
  )
  const respond = async (allow: boolean) => {
    if (!approval || working) return
    setWorking(true)
    try {
      const result = await bridge.approve(approval.challenge, allow)
      if ('issues' in result) bridge.cancel(approval.id)
    } catch {
      bridge.cancel(approval.id)
    } finally {
      setApproval(undefined)
      setWorking(false)
    }
  }
  const groups = approval ? pluginAccessGroups(approval.access, t) : undefined
  const empty = !groups || (!groups.writes.length && !groups.capabilities.length)
  return (
    <Dialog.Root
      open={!!approval}
      onOpenChange={(open) => {
        if (!open) void respond(false)
      }}
    >
      <DialogPopup initialFocus={cancel} className="plugin-approval">
        <Dialog.Title className="text-sm font-medium">
          {t(
            approval?.additional
              ? 'pluginAdditionalTitle'
              : approval?.updating
                ? 'pluginReviewTitle'
                : 'pluginInstallTitle',
          )}
        </Dialog.Title>
        <p className="mt-3 break-all font-mono text-xs">
          {approval?.name}@{approval?.version}
        </p>
        {approval?.local && (
          <p className="mt-3 rounded border p-3 text-xs leading-5">{t('pluginLocalApproval')}</p>
        )}
        <Dialog.Description className="mt-3 text-xs leading-5 text-muted-foreground">
          {approval?.additional ? t('pluginAdditionalDescription') : approval?.description}
        </Dialog.Description>
        {empty ? (
          <p className="mt-3 text-xs text-muted-foreground">{t('pluginNoAccess')}</p>
        ) : (
          <>
            <p className="mt-3 text-xs font-medium">{t('pluginDeclaredAccess')}</p>
            <div className="mt-1 space-y-1 pl-4 text-xs">
              {groups?.writes.length ? (
                <p>
                  <span className="font-medium">{t('pluginAccessWrites')}:</span>{' '}
                  <span className="lowercase">{groups.writes.join(', ')}</span>
                </p>
              ) : null}
              {groups?.capabilities.length ? (
                <div>
                  <p className="font-medium">{t('pluginAccessCapabilities')}:</p>
                  <ul className="list-inside list-disc pl-4">
                    {groups.capabilities.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </>
        )}
        <DialogActions>
          <Button
            ref={cancel}
            variant="outline"
            disabled={working}
            onClick={() => void respond(false)}
          >
            {t('cancel')}
          </Button>
          <Button disabled={working} onClick={() => void respond(true)}>
            {t(approval?.updating ? 'pluginAllowUpdate' : 'pluginInstall')}
          </Button>
        </DialogActions>
      </DialogPopup>
    </Dialog.Root>
  )
}
