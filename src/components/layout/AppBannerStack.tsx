// SPDX-License-Identifier: MIT
import { GraphFileConflictBanner } from '@/components/banners/GraphFileConflictBanner'
import { UpdateBanner } from '@/components/banners/UpdateBanner'
import { ReviewReminderBanner } from '@/components/banners/ReviewReminderBanner'
import { TelemetryConsentBanner } from '@/components/banners/TelemetryConsentBanner'
import { ToastViewport } from '@/components/ui/ToastViewport'

interface AppBannerStackProps {
  onStartReview: () => void
  onboardingActive: boolean
  consentOpen: boolean
  onDismissConsent: () => void
}

/** Fixed-position banner stack: conflict / update / review-reminder / consent
 *  banners plus the toast viewport. Moved verbatim from App; owns no state —
 *  each banner subscribes to the slice it renders internally. */
export function AppBannerStack({
  onStartReview,
  onboardingActive,
  consentOpen,
  onDismissConsent,
}: AppBannerStackProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 60,
        right: 16,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        alignItems: 'flex-end',
      }}
    >
      <GraphFileConflictBanner />
      <UpdateBanner />
      <ReviewReminderBanner onStartReview={onStartReview} onboardingActive={onboardingActive} />
      <TelemetryConsentBanner open={consentOpen} onDismiss={onDismissConsent} />
      <ToastViewport />
    </div>
  )
}
