/// <reference types="vite/client" />

// SPDX-License-Identifier: MIT

declare module '*.css' {
  const content: Record<string, string>
  export default content
}
