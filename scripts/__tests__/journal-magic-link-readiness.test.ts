import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const liveScript = "scripts/check-journal-magic-link-live.cjs";
const proofScript = "scripts/check-journal-magic-link-proof-status.cjs";
const proofFile = `docs/release/auth/JOURNAL_MAGIC_LINK_LIVE_PROOF.${process.pid}.test.json`;

function run(script: string, env: NodeJS.ProcessEnv = {}, args: string[] = []) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VITE_SUPABASE_URL: "https://your-project-ref.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_your_public_key",
      VITE_SUPABASE_ANON_KEY: "",
      ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED: "",
      ZENFLOW_JOURNAL_MAGIC_LINK_SEND_SMOKE: "",
      ZENFLOW_JOURNAL_MAGIC_LINK_ALLOW_REAL_EMAIL: "",
      ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL: "",
      ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL: "",
      ZENFLOW_JOURNAL_MAGIC_LINK_VERIFY_CAPTURED_URL: "",
      ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL: "",
      ZENFLOW_JOURNAL_MAGIC_LINK_PROOF_STATUS_REQUIRED: "",
      ZENFLOW_JOURNAL_MAGIC_LINK_PROOF_STATUS: "",
      ZENFLOW_JOURNAL_MAGIC_LINK_PROOF_FILE: proofFile,
      ...env,
    },
    encoding: "utf8",
  });
}

afterEach(() => {
  rmSync(join(process.cwd(), proofFile), { force: true });
});

describe("journal Magic Link readiness gates", () => {
  it("keeps deploy advisory-only when live readiness is not required", () => {
    const result = run(liveScript);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[journal-magic-link-live] UNVERIFIED");
    expect(result.stdout).toContain("required=false");
  });

  it("fails required live readiness when Supabase public env is missing", () => {
    const result = run(liveScript, {
      ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED: "true",
    });

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("missing_or_invalid_supabase_url");
    expect(result.stdout).toContain("missing_public_supabase_browser_key");
  });

  it("passes required prerequisite readiness without printing the public browser key", () => {
    const publicKey = "sb_publishable_fixture_must_not_print";
    const result = run(liveScript, {
      VITE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: publicKey,
      ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED: "true",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[journal-magic-link-live] PASS");
    expect(result.stdout).toContain("required=true");
    expect(result.stdout).toContain("VITE_SUPABASE_PUBLISHABLE_KEY=present");
    expect(result.stdout).not.toContain(publicKey);
  });

  it("fails required proof status when no owner proof exists", () => {
    const result = run(proofScript, {}, ["--require-pass"]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("[journal-magic-link-proof] UNVERIFIED");
  });

  it("does not allow ambient env to satisfy required proof status", () => {
    const result = run(
      proofScript,
      {
        ZENFLOW_JOURNAL_MAGIC_LINK_PROOF_STATUS: "PASS",
      },
      ["--require-pass"],
    );

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("[journal-magic-link-proof] UNVERIFIED");
  });

  it("passes proof status from a public-safe owner proof file", () => {
    mkdirSync(join(process.cwd(), "docs/release/auth"), { recursive: true });
    writeFileSync(
      join(process.cwd(), proofFile),
      JSON.stringify({ status: "PASS", checkedAt: "2026-07-04", evidence: "public-safe fixture" }),
    );

    const result = run(proofScript, {}, ["--require-pass"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[journal-magic-link-proof] PASS");
    expect(result.stdout).toContain("checkedAt=2026-07-04");
  });

  it("exposes the deploy scripts used by GitHub Pages workflows", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const deploy = readFileSync(".github/workflows/deploy.yml", "utf8");
    const preview = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");

    expect(pkg.scripts["check:journal-magic-link-live"]).toBe("node scripts/check-journal-magic-link-live.cjs");
    expect(pkg.scripts["check:journal-magic-link-proof-status"]).toBe("node scripts/check-journal-magic-link-proof-status.cjs");
    expect(pkg.scripts["check:journal-magic-link-proof-status:pass"]).toBe("node scripts/check-journal-magic-link-proof-status.cjs --require-pass");
    expect(pkg.scripts["test:release-contracts"]).toContain("scripts/__tests__/journal-magic-link-readiness.test.ts");
    expect(deploy).toContain("npm run check:journal-magic-link-live");
    expect(deploy).toContain("npm run check:journal-magic-link-proof-status");
    expect(deploy).toContain("npm run check:journal-magic-link-proof-status:pass");
    expect(preview).toContain("npm run check:journal-magic-link-live");
    expect(preview).toContain("npm run check:journal-magic-link-proof-status");
    expect(preview).toContain("npm run check:journal-magic-link-proof-status:pass");
  });
});
