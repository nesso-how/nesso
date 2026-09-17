// SPDX-License-Identifier: MIT
import { useGraphStore } from '@/store'
import { Inspector } from '@/components/Inspector'
import { MentorPanel } from '@/components/mentor/MentorPanel'

interface AppPanelsProps {
  inspectorPanelWidth: number
  onInspectorPanelWidthChange: (w: number) => void
  mentorLeftInset: number
  mentorRightInset: number
}

/** Docked-panel composition: Inspector plus the MentorPanel dock. Moved
 *  verbatim from App; width state stays App-owned and arrives via props, while
 *  the mentor-enabled gate subscribes here with a primitive selector (the
 *  mentor contract keeps MentorPanel itself untouched). */
export function AppPanels({
  inspectorPanelWidth,
  onInspectorPanelWidthChange,
  mentorLeftInset,
  mentorRightInset,
}: AppPanelsProps) {
  const mentorEnabled = useGraphStore((s) => s.settings.mentorEnabled)
  return (
    <>
      <Inspector
        panelWidth={inspectorPanelWidth}
        onPanelWidthChange={onInspectorPanelWidthChange}
      />
      {mentorEnabled && <MentorPanel leftInset={mentorLeftInset} rightInset={mentorRightInset} />}
    </>
  )
}
