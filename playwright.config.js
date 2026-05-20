// @ts-check
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4175",
    headless: true,
  },
  webServer: {
    command: "python3 -m http.server 4175",
    url: "http://localhost:4175",
    reuseExistingServer: true,
    timeout: 10000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
