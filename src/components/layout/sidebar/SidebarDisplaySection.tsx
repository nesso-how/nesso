// SPDX-License-Identifier: MIT
import { useGraphStore } from '@/store'
import { useT } from '@/i18n'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { SettingRow } from '@/components/ui/SettingRow'
import { SidebarHeatmapToggle } from '@/components/ui/HeatmapDisplayToggle'
import { sectionLabel } from './sidebarStyles'

/** Display section: per-graph appearance overrides. Subscribes directly to
 *  the display data it renders; no local state. */
export function SidebarDisplaySection() {
  const t = useT()
  const graphDisplay = useGraphStore((s) => s.graphDisplay)
  const setGraphDisplay = useGraphStore((s) => s.setGraphDisplay)
  const sidebarDisplayOpen = useGraphStore((s) => s.sidebarDisplayOpen)
  const setSidebarDisplayOpen = useGraphStore((s) => s.setSidebarDisplayOpen)

  return (
    <div style={{ flexShrink: 0, borderTop: '0.5px solid var(--line)' }}>
      <div style={{ padding: '10px 12px 8px' }}>
        <button
          onClick={() => setSidebarDisplayOpen(!sidebarDisplayOpen)}
          style={{
            appearance: 'none',
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 0,
            width: '100%',
          }}
        >
          <span style={sectionLabel}>{t.sidebar.display}</span>
          <svg
            width="9"
            height="9"
            viewBox="0 0 10 10"
            style={{
              opacity: 0.5,
              transform: sidebarDisplayOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 150ms',
            }}
          >
            <path
              d="M2 4l3 3 3-3"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {sidebarDisplayOpen && (
        <div style={{ padding: '0 12px 10px' }}>
          <SidebarHeatmapToggle />
          <SettingRow label={t.sidebar.displayOptions.edges}>
            <SegmentedControl
              options={[
                { id: 'full', label: t.sidebar.displayOptions.full },
                { id: 'category', label: t.sidebar.displayOptions.cat },
                { id: 'minimal', label: t.sidebar.displayOptions.min },
              ]}
              value={graphDisplay.edgeEncoding}
              onChange={(v) =>
                setGraphDisplay('edgeEncoding', v as 'full' | 'category' | 'minimal')
              }
            />
          </SettingRow>
          <SettingRow label={t.sidebar.displayOptions.curve}>
            <SegmentedControl
              options={[
                { id: 'arc', label: t.sidebar.displayOptions.arc },
                { id: 'straight', label: t.sidebar.displayOptions.line },
              ]}
              value={graphDisplay.curveStyle}
              onChange={(v) => setGraphDisplay('curveStyle', v as 'arc' | 'straight')}
            />
          </SettingRow>
          {graphDisplay.curveStyle === 'arc' && (
            <SettingRow label={t.sidebar.displayOptions.autoFlip}>
              <Switch
                value={graphDisplay.autoCurveFlip}
                onChange={(v) => setGraphDisplay('autoCurveFlip', v)}
              />
            </SettingRow>
          )}
          <SettingRow label={t.sidebar.displayOptions.dimUnconnected}>
            <Switch
              value={graphDisplay.dimUnconnectedOnSelect}
              onChange={(v) => setGraphDisplay('dimUnconnectedOnSelect', v)}
            />
          </SettingRow>
        </div>
      )}
    </div>
  )
}
