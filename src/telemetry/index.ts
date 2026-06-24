// SPDX-License-Identifier: MIT
import { APP_VERSION } from '@/data/appInfo'
import type { RelationTypeName } from '@/types/graph'

export { readTelemetryConsent } from './consent'

type TelemetryEvent =
  | {
      name: 'app_started'
      props: { version: string; platform: 'desktop' | 'web'; language: string }
    }
  | { name: 'node_created' }
  | { name: 'edge_created'; props: { relation_type: RelationTypeName } }
  | { name: 'mentor_session_started' }
  | { name: 'mentor_message_sent' }
  | { name: 'mentor_response_received' }
  | { name: 'mentor_request_failed'; props: { reason: 'network' | 'response' } }
  | { name: 'review_session_started' }
  | { name: 'review_card_rated'; props: { rating: 'again' | 'hard' | 'good' | 'easy' } }
  | { name: 'graph_created' }
  | { name: 'graph_imported' }
  | { name: 'graph_exported'; props: { format: 'json' | 'png' } }

let active = false
let initializing = false
let sentryLoaded = false
let posthogClient: typeof import('posthog-js').default | null = null
const pending: TelemetryEvent[] = []

export async function initTelemetry(enabled: boolean): Promise<void> {
  if (!enabled) {
    await shutdownTelemetry()
    return
  }
  if (active || initializing) return
  initializing = true

  const sentryDsn = import.meta.env.VITE_SENTRY_DSN
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY

  if (sentryDsn) await initSentry(sentryDsn)
  if (posthogKey) await initPostHog(posthogKey)

  active = Boolean(sentryDsn || posthogKey)
  initializing = false
  flush()
}

async function initSentry(dsn: string): Promise<void> {
  const Sentry = await import('@sentry/react')
  sentryLoaded = true
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: `nesso@${APP_VERSION}`,
    enabled: true,
    sendDefaultPii: false,
    integrations: (defaults) => [
      ...defaults.filter((i) => i.name !== 'CultureContext' && i.name !== 'Breadcrumbs'),
      Sentry.breadcrumbsIntegration({ console: false, dom: false }),
    ],
    maxBreadcrumbs: 20,
    tracesSampleRate: 0,
    beforeBreadcrumb: (crumb) =>
      crumb.category === 'navigation' || crumb.category === 'fetch' ? null : crumb,
    beforeSend: (event) => {
      if (event.request) {
        event.request.url = undefined
        event.request.headers = undefined
        event.request.query_string = undefined
        event.request.data = undefined
      }
      delete event.user
      return event
    },
  })
}

async function initPostHog(key: string): Promise<void> {
  const posthog = (await import('posthog-js')).default
  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    persistence: 'localStorage',
    person_profiles: 'identified_only',
    property_denylist: [
      '$current_url',
      '$pathname',
      '$referrer',
      '$referring_domain',
      '$session_entry_url',
      '$session_entry_pathname',
      '$session_entry_referrer',
      '$session_entry_referring_domain',
      '$timezone',
      '$timezone_offset',
      '$raw_user_agent',
      '$browser_language',
      '$browser_language_prefix',
      '$screen_height',
      '$screen_width',
      '$viewport_height',
      '$viewport_width',
    ],
    opt_out_capturing_by_default: true,
    sanitize_properties: (props) => {
      delete props.$current_url
      delete props.$pathname
      delete props.$session_entry_url
      return props
    },
  })
  posthog.opt_in_capturing()
  posthogClient = posthog
}

export async function shutdownTelemetry(): Promise<void> {
  pending.length = 0
  if (posthogClient) {
    posthogClient.opt_out_capturing()
    posthogClient = null
  }
  if (sentryLoaded) {
    const Sentry = await import('@sentry/react')
    await Sentry.close()
    sentryLoaded = false
  }
  active = false
}

export function track(event: TelemetryEvent): void {
  if (posthogClient) {
    capture(event)
  } else if (initializing) {
    pending.push(event)
  }
}

function flush(): void {
  if (posthogClient) for (const event of pending) capture(event)
  pending.length = 0
}

function capture(event: TelemetryEvent): void {
  if (!posthogClient) return
  if ('props' in event) posthogClient.capture(event.name, event.props)
  else posthogClient.capture(event.name)
}
