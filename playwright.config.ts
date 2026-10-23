import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "corepack pnpm build && corepack pnpm start",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Always classic mode with the snapshot data: HP-API is unreachable and every AI/Redis
    // var is blanked, so e2e never spends API money even when .env.local holds a real key.
    env: {
      HP_API_BASE_URL: "http://127.0.0.1:9",
      ANTHROPIC_API_KEY: "",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      IP_HASH_SALT: "",
    },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true },
    },
  ],
});
