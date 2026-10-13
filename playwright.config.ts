import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    // The production build is served under a subpath to prove dist/ is relocatable.
    baseURL: `http://localhost:${PORT}/play/`,
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      // On macOS use the real GPU (Metal) so fps checks mean something; elsewhere SwiftShader.
      args: [
        '--autoplay-policy=no-user-gesture-required',
        ...(process.platform === 'darwin'
          ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
          : []),
      ],
    },
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: `http://localhost:${PORT}/play/`,
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: 'ignore',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
  ],
});
