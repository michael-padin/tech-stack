import { defineConfig } from "vitest/config";

// Shared Vitest config for the workspace.
// Internal `@repo/*` packages are consumed as TypeScript source (no build step),
// so Vitest's esbuild transform compiles them on the fly — nothing to pre-build.
export default defineConfig({
  test: {
    // Unit tests live next to the code they cover, under packages/*.
    include: ["packages/*/src/**/*.{test,spec}.{ts,tsx}"],
    // Keep Playwright's e2e/ specs out of the Vitest run; they have their own runner.
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "e2e/**"],
    environment: "node",
    // Quiet, deterministic output for CI logs.
    reporters: process.env.CI ? ["dot"] : ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["packages/*/src/**/*.{ts,tsx}"],
      exclude: ["**/*.{test,spec}.{ts,tsx}", "**/*.d.ts"],
    },
  },
});
