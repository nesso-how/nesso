import { IconButton } from '@nesso-how/ui'
import { Plug } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { McpBridge } from '../../../electron/mcp/bridge'
import { setMcpEnabled } from '@/ai/mcp'
import type { HostStore } from '@/store/types'
import { useTranslation } from '@/i18n'
import { watchMcpStatus, type McpStatus } from './mcp-status.ts'

export function McpStatusButton({ bridge, store }: { bridge: McpBridge; store: HostStore }) {
  const t = useTranslation(store)
  const [status, setStatus] = useState<McpStatus>('aiSettingsWorking')
  useEffect(() => watchMcpStatus(bridge, setStatus), [bridge])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const running = status === 'mcpRunning'
  const busy = pending || status === 'aiSettingsWorking'
  const toggle = async () => {
    if (busy) return
    setPending(true)
    setError('')
    try {
      const result = await setMcpEnabled(bridge, store, !running)
      if ('issues' in result) setError(result.issues.map(({ message }) => message).join('\n'))
    } catch {
      setError(t('mcpFailure'))
    } finally {
      setPending(false)
    }
  }
  const label = [t('mcp'), t(status), busy ? '' : t(running ? 'mcpStop' : 'mcpStart'), error]
    .filter(Boolean)
    .join('. ')
  return (
    <IconButton
      className="shrink-0"
      title={label}
      aria-label={label}
      aria-pressed={running}
      aria-disabled={busy}
      onClick={() => void toggle()}
    >
      <span aria-hidden="true" className={`mcp-status relative${running ? ' running' : ''}`}>
        <Plug />
        <span
          className="mcp-status-dot absolute -right-0.5 -top-0.5"
          style={running ? { backgroundColor: 'color-mix(in srgb, #51a568 60%, var(--foreground))' } : undefined}
        />
      </span>
    </IconButton>
  )
}
