// SPDX-License-Identifier: MIT
import { useMemo } from 'react'
import { ReactFlow, Background, Controls } from '@xyflow/react'
import type {
  Node,
  Edge,
  NodeTypes,
  EdgeTypes,
  ReactFlowProps,
  Viewport,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  OnConnectStart,
  OnConnectEnd,
  OnMoveEnd,
} from '@xyflow/react'
import type { NessoGraphFile } from '@nesso-how/formats'
import type { EdgeTypeName } from '@nesso-how/vocab-learning'
import type {
  ConceptNodeData,
  NessoEdgeData,
  GraphDisplaySettings,
  CategoryPalette,
} from '@nesso-how/types'
import { GraphDisplayContext, type CategoryColorMode } from './context.js'
import { ConceptNode } from './ConceptNode.js'
import { NessoEdge } from './NessoEdge.js'

const DEFAULT_NODE_TYPES: NodeTypes = { concept: ConceptNode as NodeTypes[string] }
const DEFAULT_EDGE_TYPES: EdgeTypes = { nesso: NessoEdge as EdgeTypes[string] }

type PassthroughKeys =
  | 'nodes'
  | 'defaultNodes'
  | 'edges'
  | 'defaultEdges'
  | 'nodeTypes'
  | 'edgeTypes'
  | 'nodesDraggable'
  | 'nodesConnectable'
  | 'elementsSelectable'
  | 'onNodesChange'
  | 'onEdgesChange'
  | 'onConnect'
  | 'onConnectStart'
  | 'onConnectEnd'
  | 'onSelectionChange'
  | 'onMoveEnd'
  | 'onNodeClick'
  | 'onEdgeClick'
  | 'fitView'
  | 'defaultViewport'
  | 'minZoom'
  | 'maxZoom'
  | 'panOnDrag'
  | 'zoomOnScroll'

export interface NessoGraphProps {
  // Data — provide either a NessoGraphFile or nodes+edges directly.
  //
  // `nodes`/`edges` put ReactFlow in *controlled* mode: you own the state and must
  // also pass `onNodesChange`/`onEdgesChange` to apply drag/selection updates back —
  // required when this graph's positions live in your own store (e.g. the main app).
  //
  // `defaultNodes`/`defaultEdges` put it in *uncontrolled* mode: ReactFlow seeds its
  // internal state from them once and manages drag/selection itself — no wiring
  // needed, the right choice for decorative or one-off embeds (e.g. docs previews).
  graph?: NessoGraphFile
  nodes?: Node[]
  defaultNodes?: Node[]
  edges?: Edge[]
  defaultEdges?: Edge[]

  // Display settings (merged: reactFlowProps > display prop > graph.display > defaults).
  display?: Partial<GraphDisplaySettings>
  palette?: CategoryPalette
  /** `palette` (default) for embeds; `css` when `--cat-*` vars are set on the page. */
  categoryColorMode?: CategoryColorMode
  getRelationLabel?: (type: EdgeTypeName) => string
  isItemSelected?: (kind: 'node' | 'edge', id: string) => boolean

  // Node/edge types — override for app-specific interactivity (e.g. inline edit).
  nodeTypes?: NodeTypes
  edgeTypes?: EdgeTypes

  // Interactivity — all false by default (read-only). Override in the main app.
  nodesDraggable?: boolean
  nodesConnectable?: boolean
  elementsSelectable?: boolean
  panOnDrag?: boolean
  zoomOnScroll?: boolean

  // ReactFlow event handlers.
  onNodesChange?: OnNodesChange
  onEdgesChange?: OnEdgesChange
  onConnect?: OnConnect
  onConnectStart?: OnConnectStart
  onConnectEnd?: OnConnectEnd
  onSelectionChange?: ReactFlowProps['onSelectionChange']
  onMoveEnd?: OnMoveEnd

  // Simplified click callbacks for the read-only use-case.
  onNodeClick?: (id: string, data: ConceptNodeData) => void
  onEdgeClick?: (id: string, data: NessoEdgeData) => void

  // Viewport.
  fitView?: boolean
  defaultViewport?: Viewport
  minZoom?: number
  maxZoom?: number

  // Escape hatch for any remaining ReactFlow props not listed above.
  reactFlowProps?: Omit<ReactFlowProps, PassthroughKeys>

  // Container.
  style?: React.CSSProperties
  className?: string
  onDoubleClick?: React.MouseEventHandler<HTMLDivElement>

  // Children rendered inside ReactFlow (Background, Controls, custom panels).
  // Defaults to <Background /><Controls /> when not provided.
  children?: React.ReactNode
}

export function NessoGraph({
  graph,
  nodes: nodesProp,
  defaultNodes,
  edges: edgesProp,
  defaultEdges,
  display,
  palette = 'default',
  categoryColorMode = 'palette',
  getRelationLabel,
  isItemSelected,
  nodeTypes = DEFAULT_NODE_TYPES,
  edgeTypes = DEFAULT_EDGE_TYPES,
  nodesDraggable = false,
  nodesConnectable = false,
  elementsSelectable = true,
  panOnDrag = true,
  zoomOnScroll = true,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onConnectStart,
  onConnectEnd,
  onSelectionChange,
  onMoveEnd,
  onNodeClick,
  onEdgeClick,
  fitView = true,
  defaultViewport,
  minZoom,
  maxZoom,
  reactFlowProps,
  style,
  className,
  onDoubleClick,
  children,
}: NessoGraphProps) {
  const controlledNodes = nodesProp ?? graph?.nodes
  const controlledEdges = (edgesProp ?? graph?.edges) as Edge<NessoEdgeData>[] | undefined

  // Controlled (`nodes`/`graph`) takes precedence; otherwise fall back to ReactFlow's
  // own uncontrolled mode via `defaultNodes`/`defaultEdges` — see prop docs above.
  const nodesProps =
    controlledNodes !== undefined
      ? { nodes: controlledNodes }
      : { defaultNodes: defaultNodes ?? [] }
  const edgesProps =
    controlledEdges !== undefined
      ? { edges: controlledEdges }
      : { defaultEdges: defaultEdges ?? [] }

  const ctx = useMemo(
    () => ({
      edgeEncoding: display?.edgeEncoding ?? graph?.display?.edgeEncoding ?? 'full',
      showHeatmap: display?.showHeatmap ?? graph?.display?.showHeatmap ?? true,
      curveStyle: display?.curveStyle ?? graph?.display?.curveStyle ?? 'arc',
      autoCurveFlip: display?.autoCurveFlip ?? graph?.display?.autoCurveFlip ?? true,
      palette,
      categoryColorMode,
      getRelationLabel,
      isItemSelected,
    }),
    [display, graph?.display, palette, categoryColorMode, getRelationLabel, isItemSelected],
  )

  return (
    <div
      style={{ width: '100%', height: '100%', ...style }}
      className={className}
      onDoubleClick={onDoubleClick}
    >
      <GraphDisplayContext.Provider value={ctx}>
        <ReactFlow
          {...nodesProps}
          {...edgesProps}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={nodesDraggable}
          nodesConnectable={nodesConnectable}
          elementsSelectable={elementsSelectable}
          panOnDrag={panOnDrag}
          zoomOnScroll={zoomOnScroll}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onSelectionChange={onSelectionChange}
          onMoveEnd={onMoveEnd}
          fitView={fitView}
          defaultViewport={defaultViewport}
          minZoom={minZoom}
          maxZoom={maxZoom}
          onNodeClick={
            onNodeClick
              ? (_, node) => onNodeClick(node.id, node.data as ConceptNodeData)
              : undefined
          }
          onEdgeClick={
            onEdgeClick ? (_, edge) => onEdgeClick(edge.id, edge.data as NessoEdgeData) : undefined
          }
          {...reactFlowProps}
        >
          {children ?? (
            <>
              <Background />
              <Controls />
            </>
          )}
        </ReactFlow>
      </GraphDisplayContext.Provider>
    </div>
  )
}
