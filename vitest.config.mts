import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    css: false,
    // Keep output to results: the startup-cost hints suggest a vm pool (which splits the `graphql`
    // realm) or isolate: false (which leaks module state between files); both are deliberate here.
    experimental: { diagnostics: { environment: false, isolate: false } },
    // Pothos ships CJS and ESM builds; inlining keeps a single `graphql` realm under test.
    server: { deps: { inline: [/@pothos/, /graphql/] } },
  },
});
