import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = "scripts/check-supabase-publishable-key.cjs";

function runCheck(env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VITE_SUPABASE_URL: "https://bwgfslmxmueyglpumkbf.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
      VITE_SUPABASE_ANON_KEY: "",
      ZENFLOW_SUPABASE_PUBLISHABLE_REQUIRED: "",
      ...env,
    },
    encoding: "utf8",
  });
}

describe("Supabase publishable key readiness", () => {
  it("passes without printing the key when a modern publishable key is configured", () => {
    const result = runCheck({
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_key_must_not_print",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[supabase-publishable-key] PASS");
    expect(result.stdout).toContain("VITE_SUPABASE_PUBLISHABLE_KEY=present");
    expect(result.stdout).not.toContain("sb_publishable_fixture_key_must_not_print");
  });

  it("keeps deploy advisory-only when only the legacy anon fallback is present", () => {
    const result = runCheck({
      VITE_SUPABASE_ANON_KEY: "legacy_anon_fixture_must_not_print",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[supabase-publishable-key] UNVERIFIED");
    expect(result.stdout).toContain("legacy anon fallback");
    expect(result.stdout).toContain("VITE_SUPABASE_ANON_KEY=present");
    expect(result.stdout).not.toContain("legacy_anon_fixture_must_not_print");
  });

  it("fails when the modern publishable key is required but missing", () => {
    const result = runCheck({
      VITE_SUPABASE_ANON_KEY: "legacy_anon_fixture_must_not_print",
      ZENFLOW_SUPABASE_PUBLISHABLE_REQUIRED: "true",
    });

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("[supabase-publishable-key] UNVERIFIED");
    expect(result.stdout).toContain("Set VITE_SUPABASE_PUBLISHABLE_KEY");
    expect(result.stdout).not.toContain("legacy_anon_fixture_must_not_print");
  });

  it("exposes an npm script for local and CI readiness checks", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));

    expect(pkg.scripts["check:supabase-publishable-key"]).toBe(
      "node scripts/check-supabase-publishable-key.cjs"
    );
  });

  it("runs the advisory check in GitHub Pages deploy before the app build", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const checkIndex = workflow.indexOf("Check Supabase publishable key readiness");
    const buildIndex = workflow.indexOf("- name: Build");

    expect(checkIndex).toBeGreaterThan(-1);
    expect(buildIndex).toBeGreaterThan(checkIndex);
    expect(workflow).toContain("npm run check:supabase-publishable-key");
    expect(workflow).toContain("ZENFLOW_SUPABASE_PUBLISHABLE_REQUIRED");
  });
});
