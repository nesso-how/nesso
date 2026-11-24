import { IconButton } from '@nesso-how/ui'
import { Plug } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { McpBridge } from '../../../electron/mcp/bridge'
import { useTranslation } from '@/i18n'
import { watchMcpStatus, type McpStatus } from './mcp-status.ts'

export function McpStatusButton({ bridge, onClick }: { bridge: McpBridge; onClick: () => void }) {
  const t = useTranslation()
  const [status, setStatus] = useState<McpStatus>('aiSettingsWorking')
  useEffect(() => watchMcpStatus(bridge, setStatus), [bridge])
  const label = `${t('mcp')}: ${t(status)}`
  return (
    <IconButton className="shrink-0" title={label} aria-label={label} onClick={onClick}>
      <span
        aria-hidden="true"
        className={`mcp-status relative${status === 'mcpRunning' ? ' running' : ''}`}
      >
        <Plug />
        <span className="mcp-status-dot absolute -right-0.5 -top-0.5" />
      </span>
    </IconButton>
  )
}
