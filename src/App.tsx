import { useRef, type CSSProperties } from 'react'
import { Inspector } from '@/components/app/Inspector'
import { Navbar } from '@/components/app/Navbar'
import { PersistenceNotice } from '@/components/app/PersistenceNotice'
import { AppSidebar } from '@/components/app/Sidebar'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@nesso/ui'
import { SidebarInset, SidebarProvider } from '@/components/app/SidebarLayout'
import { getRenderer, host, useNessoStore } from '@/store'

function RendererHost() {
  const activeRendererId = useNessoStore((state) => state.preferences.activeRendererId)
  const workspace = useNessoStore((state) => state.workspace)
  const count = useNessoStore((state) => state.viewGraph.concepts.length)
  const renderer = getRenderer(activeRendererId)
  if (!renderer) return null
  const Component = renderer.component
  const name = workspace.savedViews.find((view) => view.id === workspace.activeViewId)?.name ?? 'Complete graph'
  return (
    <div className="relative h-full">
      <Component />
      <div className="pointer-events-none absolute top-4 left-4 font-mono text-[10px] text-muted-foreground">{name} · {count} {count === 1 ? 'concept' : 'concepts'}</div>
    </div>
  )
}

export default function App() {
  const panels = useNessoStore((state) => state.preferences.panels)
  const selected = useNessoStore((state) => state.selected)
  const group = useRef<HTMLDivElement>(null)

  return (
    <SidebarProvider
      style={{ '--sidebar-width': `${panels.explorerWidth}px` } as CSSProperties}
    >
      <Navbar />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar />
        <SidebarInset className="min-w-0 overflow-hidden">
          <ResizablePanelGroup
            elementRef={group}
            orientation="horizontal"
            className="min-h-0 flex-1"
            onLayoutChanged={(layout, meta) => {
              if (!selected || !meta.isUserInteraction || !group.current) return
              const inspectorWidth = Math.max(200, group.current.clientWidth * (meta.requestedLayout ?? layout).inspector / 100)
              host.store.setPanelSizes({ ...host.store.getState().preferences.panels, inspectorWidth })
            }}
          >
            <ResizablePanel id="canvas" minSize="40%">
              <RendererHost />
            </ResizablePanel>
            {selected && <ResizableHandle />}
            {selected && (
              <ResizablePanel id="inspector" defaultSize={panels.inspectorWidth} minSize={200} maxSize="45%" groupResizeBehavior="preserve-pixel-size">
                <Inspector />
              </ResizablePanel>
            )}
          </ResizablePanelGroup>
          <PersistenceNotice />
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
