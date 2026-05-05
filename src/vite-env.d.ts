/// <reference types="vite/client" />

// SPDX-License-Identifier: AGPL-3.0

interface ImportMetaEnv {
  readonly VITE_AI_API_KEY?: string
}
declare module '*.css' {
  const content: Record<string, string>
  export default content
}
