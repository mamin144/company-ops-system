import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 15000,
    env: {
      // Host-side access to the Dockerized PostgreSQL (compose publishes it
      // on 127.0.0.1:5433; credentials mirror the root .env used by compose).
      // NOTE: port 4000 is the API itself — never the database.
      DATABASE_URL: 'postgresql://cos:cos-local-dev-password@localhost:5433/cos_db',
    },
  },
});
