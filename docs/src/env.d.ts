/// <reference types="astro/client" />

interface StarlightThemeProvider {
  updatePickers(theme?: string): void;
}

declare global {
  var StarlightThemeProvider: StarlightThemeProvider;

  interface Window {
    StarlightThemeProvider: StarlightThemeProvider;
  }
}

export {};
