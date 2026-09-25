// SPDX-License-Identifier: MIT
import { defineConfig, devices } from '@playwright/test'

const CI = !!process.env.CI

/**
 * Playwright drives the web build of Nesso — every flow that runs in a plain
 * browser (`isDesktop() === false`). The native layer (fs, dialogs, IPC, file
 * watching) is covered by a separate tauri-driver lane (issue #28 follow-up),
 * so there is no shared spec code by design.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  // Serial: the specs share one Vite dev server, which gets flaky under several
  // concurrent contexts driving React Flow. UI mode (`test:e2e:ui`) is unaffected.
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  reporter: CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:5178',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Reuse a dev server already running locally; start a fresh one in CI. The
  // dedicated port keeps the Playwright-spawned server independent of an
  // interactive `pnpm dev` on 5173; Vite's strictPort pins the test port.
  webServer: {
    command: 'pnpm exec vite --port 5178',
    url: 'http://localhost:5178',
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
})
