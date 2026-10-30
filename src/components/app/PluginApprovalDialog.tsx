import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, DialogActions, DialogPopup } from '@nesso-how/ui'
import type { PluginApproval, PluginBridge } from '../../../shared/plugins.ts'
import { useTranslation } from '@/i18n'
import { pluginAccessLabels } from '@/plugins/access'

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
  const labels = approval ? pluginAccessLabels(approval.access, t) : []
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
        <Dialog.Description className="mt-3 text-xs leading-5 text-muted-foreground">
          {approval?.additional ? t('pluginAdditionalDescription') : approval?.description}
        </Dialog.Description>
        {labels.length > 0 ? (
          <ul className="mt-3 space-y-2 text-xs">
            {labels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">{t('pluginNoAccess')}</p>
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
