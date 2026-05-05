/// <reference types="vite/client" />

// SPDX-License-Identifier: AGPL-3.0
declare module '*.css' {
  const content: Record<string, string>
  export default content
}
