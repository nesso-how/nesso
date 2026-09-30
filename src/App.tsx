import { useState, type CSSProperties } from 'react'
import { Inspector } from '@/components/shell/Inspector'
import { Navbar } from '@/components/shell/Navbar'
import { AppSidebar } from '@/components/shell/Sidebar'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { getRenderer, useNessoStore } from '@/store'

function RendererHost() {
  const activeRendererId = useNessoStore((state) => state.activeRendererId)
  const renderer = getRenderer(activeRendererId)
  if (!renderer) return null
  const Component = renderer.component
  return <Component />
}

export default function App() {
  const [sidebarWidth, setSidebarWidth] = useState(256)

  return (
    <SidebarProvider
      style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      <AppSidebar onResize={setSidebarWidth} />
      <SidebarInset className="h-svh overflow-hidden">
        <Navbar />
        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
          <ResizablePanel minSize="40%">
            <RendererHost />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={280} minSize={200} maxSize="45%">
            <Inspector />
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarInset>
    </SidebarProvider>
  )
}
