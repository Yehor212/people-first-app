import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = "scripts/check-auth-providers.cjs";

function runReadiness(env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [script, "--strict"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VITE_SUPABASE_ANON_KEY: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
      FACEBOOK_APP_SECRET: "",
      TELEGRAM_CLIENT_SECRET: "",
      APPLE_CLIENT_SECRET: "",
      APPLE_PRIVATE_KEY: "",
      SUPABASE_ACCESS_TOKEN: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      ...env,
    },
    encoding: "utf8",
  });
}

describe("check-auth-providers public key readiness", () => {
  it("does not treat .env.example placeholders as live Supabase config", () => {
    const result = runReadiness();

    expect(result.stdout).toContain("Supabase public client key is not configured");
    expect(result.stdout).not.toContain("Supabase publishable key is configured without printing it");
  });

  it("treats a missing Apple flag as enabled by the app default", () => {
    const result = runReadiness({
      VITE_ENABLE_APPLE_AUTH: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(result.stdout).toContain("Apple public auth flag is enabled");
    expect(result.stdout).not.toContain("Apple public auth flag is disabled");
  });

  it("accepts a modern Supabase publishable key without requiring the legacy anon key", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(result.stdout).toContain("Supabase publishable key is configured without printing it");
    expect(result.stdout).not.toContain("Supabase anon key is not configured");
  });

  it("requires the modern publishable key in strict mode instead of legacy-only anon config", () => {
    const result = runReadiness({
      VITE_SUPABASE_ANON_KEY: "legacy_anon_fixture_key",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Strict Supabase readiness requires VITE_SUPABASE_PUBLISHABLE_KEY");
  });

  it("requires manual identity linking for Telegram account linking readiness", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
    });

    expect(result.stdout).toContain("Local Supabase manual identity linking is enabled");
  });

  it("fails strict readiness when server-only Supabase secrets are present locally", () => {
    const result = runReadiness({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key",
      SUPABASE_SERVICE_ROLE_KEY: "service_role_fixture_that_must_not_print",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("[FAIL] SUPABASE_SERVICE_ROLE_KEY is present outside the app dashboards");
    expect(result.stdout).not.toContain("service_role_fixture_that_must_not_print");
  });
});
