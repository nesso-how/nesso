import { useRef, type CSSProperties } from 'react'
import { Inspector } from '@/components/app/Inspector'
import { Navbar } from '@/components/app/Navbar'
import { PersistenceNotice } from '@/components/app/PersistenceNotice'
import { AppSidebar } from '@/components/app/Sidebar'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { getRenderer, host, useNessoStore } from '@/store'

function RendererHost() {
  const activeRendererId = useNessoStore((state) => state.preferences.activeRendererId)
  const renderer = getRenderer(activeRendererId)
  if (!renderer) return null
  const Component = renderer.component
  return <Component />
}

export default function App() {
  const panels = useNessoStore((state) => state.preferences.panels)
  const group = useRef<HTMLDivElement>(null)

  return (
    <SidebarProvider
      style={{ '--sidebar-width': `${panels.explorerWidth}px` } as CSSProperties}
    >
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden">
        <Navbar />
        <PersistenceNotice />
        <ResizablePanelGroup
          elementRef={group}
          orientation="horizontal"
          className="min-h-0 flex-1"
          onLayoutChanged={(layout, meta) => {
            if (!meta.isUserInteraction || !group.current) return
            const inspectorWidth = Math.max(200, group.current.clientWidth * (meta.requestedLayout ?? layout).inspector / 100)
            host.ui.setPanelSizes({ ...host.store.getState().preferences.panels, inspectorWidth })
          }}
        >
          <ResizablePanel id="canvas" minSize="40%">
            <RendererHost />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel id="inspector" defaultSize={panels.inspectorWidth} minSize={200} maxSize="45%" groupResizeBehavior="preserve-pixel-size">
            <Inspector />
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarInset>
    </SidebarProvider>
  )
}
