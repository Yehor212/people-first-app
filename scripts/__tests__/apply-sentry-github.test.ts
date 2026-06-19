import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = "scripts/apply-sentry-github.cjs";

function runWithFakeGh(env: NodeJS.ProcessEnv = {}, options: { failOnName?: string } = {}) {
  const binDir = mkdtempSync(join(tmpdir(), "zenflow-fake-gh-sentry-"));
  const ghPath = join(binDir, "gh");
  const logPath = join(binDir, "gh.log");
  const fakeGh = [
    "#!/usr/bin/env node",
    "const fs = require('node:fs');",
    "const args = process.argv.slice(2);",
    "const input = fs.readFileSync(0, 'utf8');",
    "fs.appendFileSync(process.env.ZENFLOW_FAKE_GH_LOG, JSON.stringify({ args, input }) + '\\n');",
    "if (args[0] === 'repo' && args[1] === 'view') { process.stdout.write('Yehor212/people-first-app\\n'); process.exit(0); }",
    "if ((args[0] === 'secret' || args[0] === 'variable') && args[1] === 'set') {",
    "  if (args[2] === process.env.ZENFLOW_FAKE_GH_FAIL_ON_NAME) { process.stderr.write('simulated failure'); process.exit(1); }",
    "  process.exit(0);",
    "}",
    "process.stderr.write('unexpected gh args: ' + args.join(' '));",
    "process.exit(2);",
  ].join("\n");
  writeFileSync(ghPath, fakeGh, { mode: 0o755 });

  try {
    const result = spawnSync(process.execPath, [script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PATH: binDir + ":" + (process.env.PATH || ""),
        ZENFLOW_FAKE_GH_LOG: logPath,
        ZENFLOW_FAKE_GH_FAIL_ON_NAME: options.failOnName || "",
        VITE_SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
        SENTRY_AUTH_TOKEN: "sentry-test-token-keep-hidden",
        SENTRY_ORG: "zenflow-org",
        SENTRY_PROJECT: "zenflow-web",
        SENTRY_BASE_URL: "",
        ZENFLOW_GITHUB_REPO: "Yehor212/people-first-app",
        ZENFLOW_SENTRY_GITHUB_APPLY: "",
        ...env,
      },
      encoding: "utf8",
    });
    let log: Array<{ args: string[]; input: string }> = [];
    try {
      log = readFileSync(logPath, "utf8")
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { args: string[]; input: string });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return { result, log };
  } finally {
    rmSync(binDir, { recursive: true, force: true });
  }
}

describe("apply-sentry-github", () => {
  it("is wired as an npm script and avoids command-argument secret bodies", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
    const source = readFileSync(script, "utf8");

    expect(pkg.scripts?.["apply:sentry-github"]).toBe("node scripts/apply-sentry-github.cjs");
    expect(source).toContain("VITE_SENTRY_DSN");
    expect(source).toContain("SENTRY_AUTH_TOKEN");
    expect(source).toContain("SENTRY_ORG");
    expect(source).toContain("SENTRY_PROJECT");
    expect(source).not.toContain("--body");
  });

  it("dry-runs by default without calling gh or printing secret values", () => {
    const { result, log } = runWithFakeGh();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[sentry-github-apply] DRY-RUN");
    expect(result.stdout).toContain("VITE_SENTRY_DSN");
    expect(result.stdout).toContain("SENTRY_AUTH_TOKEN");
    expect(result.stdout).toContain("SENTRY_ORG");
    expect(result.stdout).toContain("SENTRY_PROJECT");
    expect(result.stdout).not.toContain("sentry-test-token-keep-hidden");
    expect(result.stdout).not.toContain("https://public@example.ingest.sentry.io/1");
    expect(result.stderr).not.toContain("sentry-test-token-keep-hidden");
    expect(log).toEqual([]);
  });

  it("rejects missing or placeholder Sentry inputs before any GitHub write", () => {
    const { result, log } = runWithFakeGh({
      VITE_SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
      SENTRY_AUTH_TOKEN: "your_sentry_auth_token_ci_only",
      SENTRY_ORG: "your_sentry_org_slug",
      SENTRY_PROJECT: "your_sentry_project_slug",
      ZENFLOW_SENTRY_GITHUB_APPLY: "true",
    });

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("[sentry-github-apply] UNVERIFIED");
    expect(result.stdout).toContain("SENTRY_AUTH_TOKEN");
    expect(result.stdout).toContain("SENTRY_ORG");
    expect(result.stdout).toContain("SENTRY_PROJECT");
    expect(result.stdout).not.toContain("your_sentry_auth_token_ci_only");
    expect(result.stdout).toContain("docs/SENTRY_LIVE_PROOF.md");
    expect(log).toEqual([]);
  });

  it("writes secrets and variables through stdin only when explicitly confirmed", () => {
    const { result, log } = runWithFakeGh({
      SENTRY_BASE_URL: "https://sentry.io",
      ZENFLOW_SENTRY_GITHUB_APPLY: "true",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[sentry-github-apply] PASS");
    expect(result.stdout).not.toContain("sentry-test-token-keep-hidden");
    expect(result.stdout).not.toContain("https://public@example.ingest.sentry.io/1");

    expect(log.map((entry) => entry.args)).toEqual([
      ["secret", "set", "VITE_SENTRY_DSN", "--repo", "Yehor212/people-first-app"],
      ["secret", "set", "SENTRY_AUTH_TOKEN", "--repo", "Yehor212/people-first-app"],
      ["variable", "set", "SENTRY_ORG", "--repo", "Yehor212/people-first-app"],
      ["variable", "set", "SENTRY_PROJECT", "--repo", "Yehor212/people-first-app"],
      ["variable", "set", "SENTRY_BASE_URL", "--repo", "Yehor212/people-first-app"],
    ]);
    expect(log.map((entry) => entry.input)).toEqual([
      "https://public@example.ingest.sentry.io/1",
      "sentry-test-token-keep-hidden",
      "zenflow-org",
      "zenflow-web",
      "https://sentry.io",
    ]);
    for (const entry of log) {
      expect(entry.args.join(" ")).not.toContain(entry.input);
    }
  });


  it("loads local env files for dry-run without printing values", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "zenflow-sentry-env-root-"));
    try {
      mkdirSync(join(rootDir, "scripts"), { recursive: true });
      const sourceScript = resolve(script);
      writeFileSync(
        join(rootDir, ".env.local"),
        [
          "VITE_SENTRY_DSN=https://public@example.ingest.sentry.io/1",
          "SENTRY_AUTH_TOKEN=sentry-env-file-token-keep-hidden",
          "SENTRY_ORG=zenflow-org",
          "SENTRY_PROJECT=zenflow-web",
        ].join("\n") + "\n",
      );

      const result = spawnSync(process.execPath, [sourceScript], {
        cwd: rootDir,
        env: {
          ...process.env,
          VITE_SENTRY_DSN: "",
          SENTRY_AUTH_TOKEN: "",
          SENTRY_ORG: "",
          SENTRY_PROJECT: "",
          SENTRY_BASE_URL: "",
          ZENFLOW_GITHUB_REPO: "Yehor212/people-first-app",
          ZENFLOW_SENTRY_GITHUB_APPLY: "",
        },
        encoding: "utf8",
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("[sentry-github-apply] DRY-RUN");
      expect(result.stdout).not.toContain("sentry-env-file-token-keep-hidden");
      expect(result.stdout).not.toContain("https://public@example.ingest.sentry.io/1");
      expect(result.stderr).not.toContain("sentry-env-file-token-keep-hidden");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("reports GitHub write failures without leaking the attempted value", () => {
    const { result } = runWithFakeGh(
      {
        ZENFLOW_SENTRY_GITHUB_APPLY: "true",
      },
      { failOnName: "SENTRY_AUTH_TOKEN" },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("[sentry-github-apply] FAIL");
    expect(result.stdout).toContain("SENTRY_AUTH_TOKEN");
    expect(result.stdout).not.toContain("sentry-test-token-keep-hidden");
    expect(result.stderr).not.toContain("sentry-test-token-keep-hidden");
  });
});
