import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 15000,
    env: {
      // Host-side access to the Dockerized PostgreSQL (compose publishes it
      DATABASE_URL: process.env.DATABASE_URL || 'postgres://postgres:123@localhost:4000/cos_db',
    },
  },
});
