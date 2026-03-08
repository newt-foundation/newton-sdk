import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    include: ['src/**/*.test-d.ts'],
    typecheck: {
      enabled: true,
      ignoreSourceErrors: true,
    },
  },
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src'),
    },
  },
})
