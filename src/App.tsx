import { useState, type CSSProperties } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from '@/components/graph/Canvas'
import { AppSidebar } from '@/components/shell/Sidebar'
import { Inspector } from '@/components/shell/Inspector'
import { Navbar } from '@/components/shell/Navbar'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export default function App() {
  const [sidebarWidth, setSidebarWidth] = useState(256)

  return (
    <ReactFlowProvider>
      <SidebarProvider
        style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
      >
        <AppSidebar onResize={setSidebarWidth} />
        <SidebarInset className="h-svh overflow-hidden">
          <Navbar />
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
            <ResizablePanel minSize="40%">
              <Canvas />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={280} minSize={200} maxSize="45%">
              <Inspector />
            </ResizablePanel>
          </ResizablePanelGroup>
        </SidebarInset>
      </SidebarProvider>
    </ReactFlowProvider>
  )
}
