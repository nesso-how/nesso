// SPDX-License-Identifier: MIT
import { ActionBanner } from '@/components/banners/ActionBanner'
import { useT } from '@/i18n'
import { useGraphStore } from '@/store'

interface Props {
  open: boolean
  onDismiss: () => void
}

export function TelemetryConsentBanner({ open, onDismiss }: Props) {
  const t = useT()
  const setSetting = useGraphStore((s) => s.setSetting)
  const copy = t.onboarding.telemetry

  const finish = (telemetry: boolean) => {
    setSetting('telemetry', telemetry)
    setSetting('telemetryPromptShown', true)
    setSetting('onboardingCompleted', true)
    onDismiss()
  }

  return (
    <ActionBanner
      open={open}
      message={copy.message}
      actions={[
        { label: copy.accept, primary: true, onClick: () => finish(true) },
        { label: copy.decline, onClick: () => finish(false) },
      ]}
    />
  )
}
