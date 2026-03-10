import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    setupFiles: [],
    testTimeout: 15000,
    fileParallelism: false, // run serially to avoid DB race conditions
  },
})
