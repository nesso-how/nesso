import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  copy: ['src/styles.css'],
  platform: 'neutral',
  target: 'es2022',
  tsconfig: './tsconfig.json',
  dts: true,
})
