// SPDX-License-Identifier: MIT
import type { ThemePack } from './types.js'

/**
 * The default Nesso theme — Notion surface + Oxblood accent. This is the base
 * pack every other pack derives from via `defineTheme`. Values mirror the tokens
 * that previously lived as raw CSS in the app's `index.css`; this file is now
 * their single source of truth.
 *
 * `dark` is a *diff* over `light`: it omits `recall`, which is shared across
 * modes, and the mode-invariant axes (`font`, `type`, `space`, `radii`) are not
 * repeated per mode at all.
 */
export const defaultTheme: ThemePack = {
  id: 'default',
  name: 'Notion · Oxblood',
  categoryPalette: 'default',

  font: {
    display: "'Fraunces', Georgia, serif",
    sans: "'Inter', ui-sans-serif, system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
    featureSettings: "'ss01', 'cv11'",
  },

  type: {
    size: {
      xs: '10.5px',
      sm: '11px',
      base: '12px',
      md: '13px',
      lg: '15px',
      xl: '18px',
    },
    weight: { regular: 400, medium: 500, semibold: 600 },
    leading: { tight: 1.2, normal: 1.5 },
  },

  space: {
    0: '0',
    1: '2px',
    2: '4px',
    3: '6px',
    4: '8px',
    5: '10px',
    6: '12px',
    7: '16px',
    8: '20px',
    9: '24px',
  },

  radii: {
    none: '0',
    sm: '6px',
    md: '8px',
    lg: '14px',
    xl: '20px',
    pill: '999px',
    circle: '50%',
  },

  light: {
    color: {
      paper: '#ffffff',
      paperDeep: '#f3f1ed',
      ink: { 1: '#1a1814', 2: '#3c3830', 3: '#6a6356', 4: '#9a9080', 5: '#c4b9a4' },
      bgElev: '#fbfaf8',
      bgCard: '#ffffff',
      line: 'rgba(26, 24, 20, 0.1)',
      lineStrong: 'rgba(26, 24, 20, 0.2)',
      gridDot: 'rgba(26, 24, 20, 0.18)',
      accent: '#6e2730',
      highlight: '#6e2730',
      highlightSoft: 'rgba(110, 39, 48, 0.08)',
      highlightSelection: 'rgba(110, 39, 48, 0.22)',
      recall: { 1: '#b14a4a', 2: '#c47a3a', 3: '#b89a3a', 4: '#75752d', 5: '#467d2c' },
    },
    shadow: {
      md: '0 8px 28px -10px rgba(26, 24, 20, 0.18), 0 2px 8px rgba(26, 24, 20, 0.06)',
      lg: '0 28px 60px -16px rgba(26, 24, 20, 0.22), 0 8px 20px -8px rgba(26, 24, 20, 0.1)',
      dropLg:
        'drop-shadow(0 28px 60px rgba(26, 24, 20, 0.22)) drop-shadow(0 8px 20px rgba(26, 24, 20, 0.1))',
    },
  },

  dark: {
    color: {
      paper: '#1a1714',
      paperDeep: '#221e19',
      ink: { 1: '#f0e9d8', 2: '#d4ccba', 3: '#a39c8c', 4: '#6e6859', 5: '#423e35' },
      bgElev: '#211d18',
      bgCard: '#262019',
      line: 'rgba(240, 233, 216, 0.1)',
      lineStrong: 'rgba(240, 233, 216, 0.2)',
      gridDot: 'rgba(240, 233, 216, 0.15)',
      accent: '#c47a82',
      highlight: '#c47a82',
      highlightSoft: 'rgba(196, 122, 130, 0.12)',
      highlightSelection: 'rgba(196, 122, 130, 0.28)',
    },
    shadow: {
      md: '0 8px 28px -10px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.4)',
      lg: '0 28px 60px -16px rgba(0, 0, 0, 0.7), 0 8px 20px -8px rgba(0, 0, 0, 0.5)',
      dropLg:
        'drop-shadow(0 28px 60px rgba(0, 0, 0, 0.7)) drop-shadow(0 8px 20px rgba(0, 0, 0, 0.5))',
    },
  },
}
