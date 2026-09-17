// SPDX-License-Identifier: MIT
import { RelationTypesDialog } from '@/components/dialogs/RelationTypesDialog'
import { ReviewMode } from '@/components/review/ReviewMode'
import { WritingMode } from '@/components/writing/WritingMode'
import { ShortcutsDialog } from '@/components/dialogs/ShortcutsDialog'
import { SettingsDialog } from '@/components/dialogs/SettingsDialog'
import { AboutDialog } from '@/components/dialogs/AboutDialog'
import { SearchDialog } from '@/components/dialogs/SearchDialog'
import { WelcomeDialog } from '@/components/onboarding/WelcomeDialog'
import { CoachmarkOverlay } from '@/components/onboarding/CoachmarkOverlay'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { useOnboardingFlow } from '@/hooks/useOnboardingFlow'

interface AppOverlaysProps {
  showRelationTypes: boolean
  onCloseRelationTypes: () => void
  showReview: boolean
  onCloseReview: () => void
  writingModeNodeId: string | null
  onCloseWritingMode: () => void
  showShortcuts: boolean
  onCloseShortcuts: () => void
  showSettings: boolean
  onCloseSettings: () => void
  showAbout: boolean
  onCloseAbout: () => void
  onShowTutorial: () => void
  showSearch: boolean
  onCloseSearch: () => void
  onSelectNode: (node: { id: string; position: { x: number; y: number } }) => void
  onSelectGraph: (id: string) => void
  onboarding: ReturnType<typeof useOnboardingFlow>
}

/** Overlay/dialog composition: every modal and hand-off dialog, moved verbatim
 *  from App. All open flags and App-owned callbacks stay in App and arrive via
 *  explicit props; the onboarding hook instance is passed through (its effects
 *  keep running in App). Every dialog paints through ModalOverlay's explicit
 *  z-index, so grouping them here changes no paint order. */
export function AppOverlays({
  showRelationTypes,
  onCloseRelationTypes,
  showReview,
  onCloseReview,
  writingModeNodeId,
  onCloseWritingMode,
  showShortcuts,
  onCloseShortcuts,
  showSettings,
  onCloseSettings,
  showAbout,
  onCloseAbout,
  onShowTutorial,
  showSearch,
  onCloseSearch,
  onSelectNode,
  onSelectGraph,
  onboarding,
}: AppOverlaysProps) {
  return (
    <>
      <RelationTypesDialog open={showRelationTypes} onClose={onCloseRelationTypes} />
      <ReviewMode open={showReview} onClose={onCloseReview} />
      {writingModeNodeId !== null && (
        <WritingMode nodeId={writingModeNodeId} onClose={onCloseWritingMode} />
      )}
      <ShortcutsDialog open={showShortcuts} onClose={onCloseShortcuts} />
      <SettingsDialog open={showSettings} onClose={onCloseSettings} />
      <AboutDialog open={showAbout} onClose={onCloseAbout} onShowTutorial={onShowTutorial} />
      <SearchDialog
        open={showSearch}
        onClose={onCloseSearch}
        onSelectNode={onSelectNode}
        onSelectGraph={onSelectGraph}
      />
      <WelcomeDialog
        open={onboarding.phase === 'welcome'}
        onShowMeHow={onboarding.startTour}
        onSkipIntro={onboarding.skipOnboarding}
      />
      {onboarding.phase === 'tour' && !showReview && (
        <CoachmarkOverlay
          stepIndex={onboarding.tourStep}
          onSkip={onboarding.skipOnboarding}
          onNext={onboarding.advanceTour}
        />
      )}
      <ConfirmDialog />
    </>
  )
}
