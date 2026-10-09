import { defineConfig } from '@playwright/test'

const chromeExecutable = process.env.PLAYWRIGHT_CHROME_EXECUTABLE
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    browserName: 'chromium',
    launchOptions: {
      executablePath: chromeExecutable,
    },
  },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
