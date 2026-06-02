/// <reference types="astro/client" />

// SPDX-License-Identifier: MIT
interface StarlightThemeProvider {
  updatePickers(theme?: string): void
}

declare global {
  var StarlightThemeProvider: StarlightThemeProvider

  interface Window {
    StarlightThemeProvider: StarlightThemeProvider
  }
}

export {}
