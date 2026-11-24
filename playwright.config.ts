import { defineConfig, devices } from "@playwright/test";

/** A port of its own, so e2e never collides with `pnpm dev` on 3000. */
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `corepack pnpm build && corepack pnpm start -p ${PORT}`,
    port: PORT,
    // Never reuse a running server: a dev server has loaded .env.local (with the real key), and
    // the blanked env below only applies to a server Playwright starts itself.
    reuseExistingServer: false,
    timeout: 180_000,
    // Always classic mode (the snapshot is the only data path): every AI/Redis
    // var is blanked, so e2e never spends API money even when .env.local holds a real key.
    env: {
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
