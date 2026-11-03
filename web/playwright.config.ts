// Responsive layout suite: `npm run test:responsive`.
// Runs against a local Vite dev server unless BASE_URL is set
// (e.g. BASE_URL=https://mheu.lol). Signed-in runs need
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment.

import { defineConfig, devices } from '@playwright/test'

const external = process.env.BASE_URL

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.e2e.ts',
  timeout: 10 * 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: external ?? 'http://localhost:4173',
    browserName: 'chromium',
  },
  webServer: external ? undefined : {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
