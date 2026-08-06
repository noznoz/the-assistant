import { defineConfig } from 'vitest/config'

// Unit tests for the pure logic in src/lulu/lib and the local store. jsdom gives
// us localStorage/Date so store tests run without a browser. Tests live next to
// nothing UI-related — component/route coverage is the Playwright smoke test.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    globals: false,
  },
})
