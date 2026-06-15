// SPDX-License-Identifier: MIT
import { useGraphStore, selectedNodeSelector, selectedEdgeSelector } from '@/store'
import { EdgeInspector } from './inspector/EdgeInspector'
import { NodeInspector } from './inspector/NodeInspector'
import { InspectorRail } from './inspector/inspectorChrome'

export {
  clampInspectorPanelWidth,
  readInspectorPanelWidth,
  writeInspectorPanelWidth,
  INSPECTOR_CANVAS_LEFT_GUTTER,
} from './inspector/layout'
export { INSPECTOR_RAIL_WIDTH } from './inspector/inspectorChrome'

export function Inspector({
  panelWidth,
  onPanelWidthChange,
}: {
  panelWidth: number
  onPanelWidthChange: (w: number) => void
}) {
  const selectedNode = useGraphStore(selectedNodeSelector)
  const selectedEdge = useGraphStore(selectedEdgeSelector)
  const collapsed = useGraphStore((s) => s.inspectorCollapsed)

  if (!selectedNode && !selectedEdge) return null
  if (collapsed) return <InspectorRail />
  if (selectedNode) {
    return <NodeInspector panelWidth={panelWidth} onPanelWidthChange={onPanelWidthChange} />
  }
  return <EdgeInspector panelWidth={panelWidth} onPanelWidthChange={onPanelWidthChange} />
}
