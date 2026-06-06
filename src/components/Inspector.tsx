// SPDX-License-Identifier: MIT
import { useGraphStore, selectedNodeSelector, selectedEdgeSelector } from '@/store/graph'
import { EdgeInspector } from './inspector/EdgeInspector'
import { NodeInspector } from './inspector/NodeInspector'

export {
  clampInspectorPanelWidth,
  readInspectorPanelWidth,
  writeInspectorPanelWidth,
  INSPECTOR_CANVAS_LEFT_GUTTER,
} from './inspector/layout'

export function Inspector({
  leftOffset = 0,
  panelWidth,
  onPanelWidthChange,
}: {
  leftOffset?: number
  panelWidth: number
  onPanelWidthChange: (w: number) => void
}) {
  const selectedNode = useGraphStore(selectedNodeSelector)
  const selectedEdge = useGraphStore(selectedEdgeSelector)

  if (selectedNode) {
    return (
      <NodeInspector
        leftOffset={leftOffset}
        panelWidth={panelWidth}
        onPanelWidthChange={onPanelWidthChange}
      />
    )
  }
  if (selectedEdge) {
    return (
      <EdgeInspector
        leftOffset={leftOffset}
        panelWidth={panelWidth}
        onPanelWidthChange={onPanelWidthChange}
      />
    )
  }
  return null
}
