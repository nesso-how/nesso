import { IconButton } from '@nesso-how/ui'
import { Plug } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { McpBridge, McpState } from '../../../electron/mcp/bridge'
import { mcpStatus, watchMcpState } from '@/ai/mcp'
import { useNessoStore } from '@/store'
import { useTranslation } from '@/i18n'

export function McpStatusButton({ bridge, onOpen }: { bridge: McpBridge; onOpen: () => void }) {
  const t = useTranslation()
  const enabled = useNessoStore((state) => state.preferences.mcpEnabled ?? false)
  const [state, setState] = useState<McpState | null>(null)
  useEffect(() => watchMcpState(bridge, setState, () => {}), [bridge])
  if (!state || !(enabled || state.running)) return null
  const status = mcpStatus(state, enabled)
  const label = `${t('mcp')}: ${t(status)}`
  return (
    <IconButton className="shrink-0" title={label} aria-label={label} onClick={onOpen}>
      <span aria-hidden="true" className="relative inline-flex">
        <Plug />
        <span className="mcp-status absolute -right-0.5 -top-0.5" data-status={status}>
          <span className="mcp-status-dot" />
        </span>
      </span>
    </IconButton>
  )
}
