import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { isDirectCliInvocation } from "../rag/directCli";

const require = createRequire(import.meta.url);
const TSX_LOADER = require.resolve("tsx");
const SEARCH_CLI = resolve("scripts/rag/search-project-docs.ts");

describe("RAG direct CLI entrypoint detection", () => {
  it("routes both RAG CLIs through the shared portable direct-entry predicate", () => {
    for (const sourcePath of ["scripts/rag/preflight.ts", "scripts/rag/search-project-docs.ts"]) {
      const source = readFileSync(sourcePath, "utf8");
      expect(source).toContain('import { isDirectCliInvocation } from "./directCli"');
      expect(source).toContain("isDirectCliInvocation(import.meta.url, process.argv[1])");
      expect(source).not.toContain("`file://${process.argv[1]}`");
    }
  });

  it("matches a canonical POSIX argv path through a file URL", () => {
    const canonicalize = (candidate: string) => candidate.replace("/private/var/", "/var/");

    expect(
      isDirectCliInvocation(
        "file:///var/tmp/ZenFlow/scripts/rag/preflight.ts",
        "/private/var/tmp/ZenFlow/scripts/rag/preflight.ts",
        {
          canonicalize,
          cwd: "/var/tmp/ZenFlow",
          platform: "darwin",
        }
      )
    ).toBe(true);
  });

  it("matches Windows-shaped separators and drive-letter case after canonicalization", () => {
    const canonicalize = (candidate: string) => candidate.toLowerCase();

    expect(
      isDirectCliInvocation(
        "file:///C:/ZenFlow/scripts/rag/preflight.ts",
        "c:\\zenflow\\scripts\\rag\\preflight.ts",
        {
          canonicalize,
          cwd: "C:\\ZenFlow",
          platform: "win32",
        }
      )
    ).toBe(true);
  });

  it("matches a relative Windows-shaped argv path against its canonical module URL", () => {
    const canonicalize = (candidate: string) => candidate.toLowerCase();

    expect(
      isDirectCliInvocation(
        "file:///C:/ZenFlow/scripts/rag/search-project-docs.ts",
        "scripts\\rag\\search-project-docs.ts",
        {
          canonicalize,
          cwd: "C:\\ZenFlow",
          platform: "win32",
        }
      )
    ).toBe(true);
  });

  it("does not match another RAG entrypoint or a missing argv path", () => {
    const options = {
      canonicalize: (candidate: string) => candidate,
      cwd: "/work/ZenFlow",
      platform: "linux" as const,
    };

    expect(
      isDirectCliInvocation(
        "file:///work/ZenFlow/scripts/rag/preflight.ts",
        "/work/ZenFlow/scripts/rag/search-project-docs.ts",
        options
      )
    ).toBe(false);
    expect(
      isDirectCliInvocation("file:///work/ZenFlow/scripts/rag/preflight.ts", undefined, options)
    ).toBe(false);
  });

  it.each([
    ["an unknown option", ["agent audit", "--definitely-unknown", "--json"], "Unknown option"],
    ["an invalid limit", ["agent audit", "--limit=bogus", "--json"], "Invalid --limit"],
    ["an empty limit", ["agent audit", "--limit=", "--json"], "Invalid --limit"],
    ["a duplicate limit", ["agent audit", "--limit=2", "--limit=3", "--json"], "Duplicate --limit"],
    ["a duplicate JSON flag", ["agent audit", "--json", "--json"], "Duplicate --json"],
  ])("fails closed on %s", (_label, args, expectedError) => {
    const result = spawnSync(process.execPath, ["--import", TSX_LOADER, SEARCH_CLI, ...args], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(expectedError);
  });

  it.each([
    ["a zero limit", ["agent audit", "--limit=0", "--json"], "Invalid --limit"],
    ["a decimal limit", ["agent audit", "--limit=1.5", "--json"], "Invalid --limit"],
    ["an exponent limit", ["agent audit", "--limit=1e2", "--json"], "Invalid --limit"],
    [
      "an unsafe integer limit",
      ["agent audit", "--limit=9007199254740992", "--json"],
      "Invalid --limit",
    ],
    ["a bare limit flag", ["agent audit", "--limit", "--json"], "Unknown option"],
    ["a valued JSON flag", ["agent audit", "--json=true"], "Unknown option"],
  ])("fails closed on %s", (_label, args, expectedError) => {
    const result = spawnSync(process.execPath, ["--import", TSX_LOADER, SEARCH_CLI, ...args], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(expectedError);
  });

  it("accepts one positive integer limit and one JSON flag", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", TSX_LOADER, SEARCH_CLI, "agent audit", "--limit=2", "--json"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as { results?: unknown[] };
    expect(output.results).toHaveLength(2);
  });
});
