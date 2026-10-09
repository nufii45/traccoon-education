import { defineConfig } from '@playwright/test'
import { APP_ORIGIN } from './e2e/networkPolicy'

// Uses the installed system browser; no `playwright install` download needed.
// Override with PLAYWRIGHT_CHROME_EXECUTABLE, e.g. Edge on Windows:
// C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
const defaultChromeExecutable = (platform: NodeJS.Platform): string => {
  if (platform === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  }
  if (platform === 'linux') {
    return '/usr/bin/google-chrome'
  }
  return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
}

const chromeExecutable = process.env.PLAYWRIGHT_CHROME_EXECUTABLE
  ?? defaultChromeExecutable(process.platform)
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 30_000,
  use: {
    baseURL: APP_ORIGIN,
    browserName: 'chromium',
    launchOptions: {
      executablePath: chromeExecutable,
    },
  },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 4174 --strictPort',
    url: APP_ORIGIN,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
