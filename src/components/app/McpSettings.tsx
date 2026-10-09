import { useEffect, useId, useRef, useState } from 'react'
import { Button, ConfirmDialog, Field, IconButton, Input, Label } from '@nesso/ui'
import { Check, Copy, Eye, EyeOff, Play, RefreshCw, Square } from 'lucide-react'
import type { AiResult } from '@nesso/ai'
import type { McpBridge, McpState } from '../../../electron/mcp-bridge'
import { useTranslation } from '@/i18n'

export function McpSettings({ bridge }: { bridge: McpBridge }) {
  const t = useTranslation()
  const id = useId()
  const [state, setState] = useState<McpState | null>(null)
  const [busy, setBusy] = useState(true)
  const [showToken, setShowToken] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [issue, setIssue] = useState('')
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const clearCopied = () => { clearTimeout(copiedTimer.current); setCopiedUrl(false); setCopiedToken(false) }
  useEffect(() => {
    let mounted = true
    const unsubscribe = bridge.subscribeState((next) => {
      if (!mounted) return
      setState(next)
      clearCopied()
      setShowToken(false)
    })
    void bridge.getState().then((result) => {
      if (!mounted) return
      if ('issues' in result) setIssue(result.issues.map(({ message }) => message).join('\n'))
      else setState(result.value)
    }).catch(() => { if (mounted) setIssue(t('mcpFailure')) }).finally(() => { if (mounted) setBusy(false) })
    return () => { mounted = false; unsubscribe(); clearTimeout(copiedTimer.current) }
  }, [bridge, t])
  const run = async (action: () => Promise<AiResult<McpState>>) => {
    setBusy(true)
    setIssue('')
    clearCopied()
    try {
      const result = await action()
      if ('issues' in result) setIssue(result.issues.map(({ message }) => message).join('\n'))
      else setState(result.value)
    } catch { setIssue(t('mcpFailure')) } finally { setBusy(false) }
  }
  const copy = async (kind: 'url' | 'token') => {
    try {
      const result = await (kind === 'url' ? bridge.copyUrl() : bridge.copyToken())
      if ('issues' in result) { setIssue(t('mcpCopyFailure')); return }
      if (kind === 'url') setCopiedUrl(true)
      else setCopiedToken(true)
      setIssue('')
      clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(clearCopied, 2500)
    } catch { setIssue(t('mcpCopyFailure')) }
  }
  const running = state?.running ?? false
  return <>
    <section className="settings-section" aria-labelledby={`${id}-title`}>
      <div className="ai-section-heading">
        <div className="mcp-title-group">
          <h3 id={`${id}-title`}>{t('mcp')}</h3>
          <span className={`mcp-status${running ? ' running' : ''}`} role="status">
            <span className="mcp-status-dot" aria-hidden="true" />{t(running ? 'mcpRunning' : 'mcpStopped')}
          </span>
        </div>
        <Button size="sm" variant="ghost" className="ai-new-connection" disabled={busy || !state} onClick={() => void run(() => bridge.setEnabled(!running))}>
          {running ? <Square /> : <Play />}{t(busy ? 'aiSettingsWorking' : running ? 'mcpStop' : 'mcpStart')}
        </Button>
      </div>
      <p className="settings-page-description">{t('mcpDescription')} {t('mcpClientHint')}</p>
      {state && <div className="mcp-credentials">
        <Field className="mcp-field">
          <Label htmlFor={`${id}-url`}>{t('mcpUrl')}</Label>
          <div className="mcp-credential">
            <Input id={`${id}-url`} value={state.url} readOnly spellCheck={false} className="mcp-credential-input" />
            <div className="mcp-credential-actions">
              <IconButton aria-label={t(copiedUrl ? 'mcpUrlCopied' : 'mcpCopyUrl')} title={t(copiedUrl ? 'mcpUrlCopied' : 'mcpCopyUrl')} disabled={busy} onClick={() => void copy('url')}>{copiedUrl ? <Check /> : <Copy />}</IconButton>
            </div>
          </div>
        </Field>
        <Field className="mcp-field">
          <Label htmlFor={`${id}-token`}>{t('mcpToken')}</Label>
          <div className="mcp-credential">
            <Input id={`${id}-token`} type={showToken ? 'text' : 'password'} value={state.token} readOnly autoComplete="off" spellCheck={false} className="mcp-credential-input mcp-credential-input-multiple" />
            <div className="mcp-credential-actions">
              <IconButton aria-label={t(showToken ? 'mcpHideToken' : 'mcpShowToken')} title={t(showToken ? 'mcpHideToken' : 'mcpShowToken')} aria-pressed={showToken} disabled={busy} onClick={() => setShowToken(!showToken)}>{showToken ? <EyeOff /> : <Eye />}</IconButton>
              <IconButton aria-label={t('mcpRegenerate')} title={t('mcpRegenerate')} disabled={busy} onClick={() => setConfirming(true)}><RefreshCw /></IconButton>
              <IconButton aria-label={t(copiedToken ? 'mcpTokenCopied' : 'mcpCopyToken')} title={t(copiedToken ? 'mcpTokenCopied' : 'mcpCopyToken')} disabled={busy} onClick={() => void copy('token')}>{copiedToken ? <Check /> : <Copy />}</IconButton>
            </div>
          </div>
        </Field>
      </div>}
      {issue && <p role="alert" className="mt-3 text-xs whitespace-pre-wrap">{t('mcpFailure')} {issue}</p>}
    </section>
    <ConfirmDialog open={confirming} onOpenChange={setConfirming} title={t('mcpRegenerateTitle')} description={t('mcpRegenerateDescription')} cancelLabel={t('cancel')} confirmLabel={t('mcpRegenerate')} onConfirm={() => { setConfirming(false); void run(bridge.regenerateAccess) }} />
  </>
}
