const { defineConfig } = require("@playwright/test");

const PORT = 4173;

module.exports = defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}/`,
    viewport: { width: 390, height: 844 },
    // Point at a preinstalled Chromium instead of downloading one, if needed.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "node tests/serve.js",
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) }
  }
});
