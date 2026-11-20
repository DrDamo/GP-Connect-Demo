import { defineConfig } from 'vitest/config'

// Front-end unit tests only. The backend has its own runner (server/, node --test).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
