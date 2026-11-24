import { IconButton, Menu, MenuItem, MenuPopup } from '@nesso-how/ui'
import { Play, Plug, Square } from 'lucide-react'
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
  const label = `${t('mcp')}: ${t(status)}`
  return (
    <Menu.Root>
      <Menu.Trigger render={<IconButton className="shrink-0" title={label} aria-label={label} />}>
        <span
          aria-hidden="true"
          className={`mcp-status relative${status === 'mcpRunning' ? ' running' : ''}`}
        >
          <Plug />
          <span className="mcp-status-dot absolute -right-0.5 -top-0.5" />
        </span>
      </Menu.Trigger>
      <MenuPopup side="top" align="end">
        <div role="status" className="px-2.5 py-2 text-xs text-muted-foreground">
          {label}
        </div>
        <MenuItem disabled={busy} closeOnClick={false} onClick={() => void toggle()}>
          {running ? <Square /> : <Play />}
          {t(running ? 'mcpStop' : 'mcpStart')}
        </MenuItem>
        {error && (
          <div role="alert" className="max-w-64 px-2.5 py-2 text-xs">
            {error}
          </div>
        )}
      </MenuPopup>
    </Menu.Root>
  )
}
