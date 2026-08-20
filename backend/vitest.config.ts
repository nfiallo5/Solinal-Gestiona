import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests share one Postgres database, so run files serially.
    fileParallelism: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 20_000,
  },
});
