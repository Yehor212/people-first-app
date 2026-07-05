import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = "scripts/bootstrap-journal-magic-link-github.cjs";

function validEnv(extra: Record<string, string> = {}) {
  return {
    ...process.env,
    ZENFLOW_GITHUB_REPO: "Yehor212/people-first-app",
    SUPABASE_PROJECT_REF: "bwgfslmxmueyglpumkbf",
    VITE_SUPABASE_URL: "https://bwgfslmxmueyglpumkbf.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_1234567890abcdef",
    SUPABASE_ACCESS_TOKEN: "sbp_test_1234567890abcdef1234567890abcdef",
    ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL: "journal-smoke@example.test",
    ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL:
      "https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/verify?token_hash=abc123&type=magiclink&redirect_to=https%3A%2F%2Fyehor212.github.io%2Fpeople-first-app%2Fdiary%3Fnav%3Dv2%26navLayout%3Dphone%26journalReset%3D00000000000000000000000000000000",
    ZENFLOW_JOURNAL_MAGIC_LINK_CONFIRM_SMOKE_INBOX: "true",
    ZENFLOW_JOURNAL_MAGIC_LINK_CONFIRM_FRESH_CAPTURED_URL: "true",
    ZENFLOW_JOURNAL_MAGIC_LINK_BOOTSTRAP_OFFLINE: "true",
    ...extra,
  };
}

function runBootstrap(args: string[], env: Record<string, string | undefined>) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  });
}

describe("bootstrap-journal-magic-link-github", () => {
  it("is wired as an npm apply script and included in release-contract tests", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
    const source = readFileSync(script, "utf8");

    expect(pkg.scripts?.["apply:journal-magic-link-github-secrets"]).toBe(
      "node scripts/bootstrap-journal-magic-link-github.cjs --apply",
    );
    expect(pkg.scripts?.["clear:journal-magic-link-captured-url"]).toBe(
      "node scripts/bootstrap-journal-magic-link-github.cjs --clear-captured-url --dry-run",
    );
    expect(pkg.scripts?.["clear:journal-magic-link-captured-url:apply"]).toBe(
      "node scripts/bootstrap-journal-magic-link-github.cjs --clear-captured-url --apply",
    );
    expect(pkg.scripts?.["test:release-contracts"]).toContain(
      "scripts/__tests__/journal-magic-link-github-bootstrap.test.ts",
    );
    expect(source).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CONFIRM_SMOKE_INBOX");
    expect(source).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CONFIRM_FRESH_CAPTURED_URL");
    expect(source).not.toContain("console.log(value");
    expect(source).toContain('["secret", "set", name, "--repo", packet.repo]');
    expect(source).not.toContain('["secret", "set", name, "--body"');
  });

  it("rejects placeholders and prints only names, not secret values", () => {
    const result = runBootstrap(["--dry-run"], validEnv({
      SUPABASE_ACCESS_TOKEN: "your-access-token",
      ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL: "dedicated-smoke-inbox@example.com",
    }));

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("[journal-magic-link-bootstrap] UNVERIFIED");
    expect(result.stdout).toContain("SUPABASE_ACCESS_TOKEN");
    expect(result.stdout).not.toContain("your-access-token");
    expect(result.stdout).not.toContain("dedicated-smoke-inbox@example.com");
  });

  it("refuses to write journal proof secrets outside the canonical GitHub repo", () => {
    const result = runBootstrap(["--dry-run"], validEnv({
      ZENFLOW_GITHUB_REPO: "Attacker/people-first-app",
    }));

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("GitHub repository must be Yehor212/people-first-app");
    expect(result.stdout).not.toContain("sbp_test_");
    expect(result.stdout).not.toContain("token_hash=");
  });

  it("refuses to accept a captured URL without an explicit freshness confirmation", () => {
    const result = runBootstrap(["--dry-run"], validEnv({
      ZENFLOW_JOURNAL_MAGIC_LINK_CONFIRM_FRESH_CAPTURED_URL: "",
    }));

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CONFIRM_FRESH_CAPTURED_URL");
    expect(result.stdout).not.toContain("/auth/v1/verify");
    expect(result.stdout).not.toContain("token_hash=");
  });

  it("refuses app callback URLs because proof must start at Supabase verify", () => {
    const result = runBootstrap(["--dry-run"], validEnv({
      ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL:
        "https://yehor212.github.io/people-first-app/diary?nav=v2&journalReset=00000000000000000000000000000000#access_token=secret&refresh_token=secret",
    }));

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL");
    expect(result.stdout).not.toContain("access_token=secret");
  });

  it("accepts the project custom Supabase Auth domain for fresh captured Magic Links", () => {
    const result = runBootstrap(["--dry-run"], validEnv({
      ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL:
        "https://api.zenflowapp.online/auth/v1/verify?token=secret&type=magiclink&redirect_to=https%3A%2F%2Fyehor212.github.io%2Fpeople-first-app%2Fdiary%3Fnav%3Dv2%26navLayout%3Dphone%26journalReset%3D00000000000000000000000000000000",
    }));

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[journal-magic-link-bootstrap] PASS");
    expect(result.stdout).not.toContain("token=secret");
  });

  it("dry-runs a complete safe packet without calling gh or printing values", () => {
    const result = runBootstrap(["--dry-run"], validEnv());

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[journal-magic-link-bootstrap] PASS");
    expect(result.stdout).toContain("would set GitHub secret SUPABASE_ACCESS_TOKEN");
    expect(result.stdout).toContain("would set GitHub variable SUPABASE_PROJECT_REF");
    expect(result.stdout).not.toContain("sbp_test_");
    expect(result.stdout).not.toContain("journal-smoke@example.test");
    expect(result.stdout).not.toContain("token_hash=");
  });

  it("applies secrets through gh stdin so secret values are not command arguments", () => {
    const binDir = mkdtempSync(join(tmpdir(), "zenflow-fake-gh-bootstrap-"));
    const callsPath = join(binDir, "calls.jsonl");
    const ghPath = join(binDir, "gh");
    const fakeGh = [
      "#!/usr/bin/env node",
      "const fs = require('node:fs');",
      "const args = process.argv.slice(2);",
      "let stdin = '';",
      "process.stdin.setEncoding('utf8');",
      "process.stdin.on('data', (chunk) => { stdin += chunk; });",
      "process.stdin.on('end', () => {",
      "  fs.appendFileSync(process.env.ZENFLOW_FAKE_GH_CALLS, JSON.stringify({ args, stdinLength: stdin.length, stdinPreview: stdin.slice(0, 4) }) + '\\n');",
      "  process.exit(0);",
      "});",
      "setTimeout(() => process.stdin.emit('end'), 20);",
    ].join("\n");
    writeFileSync(ghPath, fakeGh, { mode: 0o755 });

    try {
      const result = runBootstrap(["--apply"], {
        ...validEnv(),
        PATH: binDir + ":" + (process.env.PATH || ""),
        ZENFLOW_FAKE_GH_CALLS: callsPath,
      });
      const calls = readFileSync(callsPath, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));
      const secretCalls = calls.filter((call) => call.args[0] === "secret" && call.args[1] === "set");

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("[journal-magic-link-bootstrap] PASS");
      expect(result.stdout).not.toContain("sbp_test_");
      expect(result.stdout).not.toContain("journal-smoke@example.test");
      expect(secretCalls.length).toBeGreaterThanOrEqual(5);
      expect(secretCalls.every((call) => !call.args.some((arg: string) => arg.includes("sbp_test_")))).toBe(true);
      expect(secretCalls.every((call) => call.stdinLength > 0)).toBe(true);
    } finally {
      rmSync(binDir, { recursive: true, force: true });
    }
  });

  it("clears the one-time captured URL secret without requiring or printing its value", () => {
    const binDir = mkdtempSync(join(tmpdir(), "zenflow-fake-gh-clear-captured-"));
    const callsPath = join(binDir, "calls.jsonl");
    const ghPath = join(binDir, "gh");
    const fakeGh = [
      "#!/usr/bin/env node",
      "const fs = require('node:fs');",
      "const args = process.argv.slice(2);",
      "fs.appendFileSync(process.env.ZENFLOW_FAKE_GH_CALLS, JSON.stringify({ args }) + '\\n');",
      "process.exit(0);",
    ].join("\n");
    writeFileSync(ghPath, fakeGh, { mode: 0o755 });

    try {
      const result = runBootstrap(["--clear-captured-url", "--apply"], {
        ...process.env,
        PATH: binDir + ":" + (process.env.PATH || ""),
        ZENFLOW_GITHUB_REPO: "Yehor212/people-first-app",
        ZENFLOW_FAKE_GH_CALLS: callsPath,
        ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL: "https://api.zenflowapp.online/auth/v1/verify?token=secret",
      });
      const calls = readFileSync(callsPath, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("deleted GitHub secret ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL");
      expect(result.stdout).not.toContain("token=secret");
      expect(calls).toEqual([
        {
          args: [
            "secret",
            "delete",
            "ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL",
            "--repo",
            "Yehor212/people-first-app",
          ],
        },
      ]);
    } finally {
      rmSync(binDir, { recursive: true, force: true });
    }
  });

  it("refuses to clear the captured URL secret outside the canonical GitHub repo", () => {
    const result = runBootstrap(["--clear-captured-url", "--apply"], {
      ...process.env,
      ZENFLOW_GITHUB_REPO: "Attacker/people-first-app",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("GitHub repository must be Yehor212/people-first-app");
  });


  it("treats an already-missing captured URL secret as cleared", () => {
    const binDir = mkdtempSync(join(tmpdir(), "zenflow-fake-gh-clear-missing-"));
    const callsPath = join(binDir, "calls.jsonl");
    const ghPath = join(binDir, "gh");
    const fakeGh = [
      "#!/usr/bin/env node",
      "const fs = require('node:fs');",
      "const args = process.argv.slice(2);",
      "fs.appendFileSync(process.env.ZENFLOW_FAKE_GH_CALLS, JSON.stringify({ args }) + '\\n');",
      "console.error('failed to delete secret ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL: HTTP 404');",
      "process.exit(1);",
    ].join("\n");
    writeFileSync(ghPath, fakeGh, { mode: 0o755 });

    try {
      const result = runBootstrap(["--clear-captured-url", "--apply"], {
        ...process.env,
        PATH: binDir + ":" + (process.env.PATH || ""),
        ZENFLOW_GITHUB_REPO: "Yehor212/people-first-app",
        ZENFLOW_FAKE_GH_CALLS: callsPath,
      });
      const calls = readFileSync(callsPath, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("GitHub secret ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL was already absent");
      expect(calls).toEqual([
        {
          args: [
            "secret",
            "delete",
            "ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL",
            "--repo",
            "Yehor212/people-first-app",
          ],
        },
      ]);
    } finally {
      rmSync(binDir, { recursive: true, force: true });
    }
  });

});
