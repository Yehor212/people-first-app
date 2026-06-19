import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const script = "scripts/check-sentry-artifacts.cjs";

function runGuard(distDir: string) {
  return spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ZENFLOW_DIST_DIR: distDir,
    },
    encoding: "utf8",
  });
}

function fixture() {
  return mkdtempSync(join(tmpdir(), "sentry-artifacts-"));
}

describe("check-sentry-artifacts", () => {
  it("is exposed as an npm script", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };

    expect(pkg.scripts?.["check:sentry-artifacts"]).toBe("node scripts/check-sentry-artifacts.cjs");
  });

  it("passes when dist has no public source maps or sourceMappingURL links", () => {
    const dist = fixture();
    mkdirSync(join(dist, "assets"));
    writeFileSync(join(dist, "assets", "index.js"), "console.log('ok');");
    writeFileSync(join(dist, "assets", "index.css"), "body{color:black}");

    const result = runGuard(dist);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[sentry-artifacts] PASS");
  });

  it("fails when public .map files remain in dist", () => {
    const dist = fixture();
    mkdirSync(join(dist, "assets"));
    writeFileSync(join(dist, "assets", "index.js.map"), "{}");

    const result = runGuard(dist);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("[sentry-artifacts] FAIL");
    expect(result.stdout).toContain("index.js.map");
  });

  it("fails when built files reference public source maps", () => {
    const dist = fixture();
    mkdirSync(join(dist, "assets"));
    writeFileSync(
      join(dist, "assets", "index.js"),
      "console.log('ok');\n//# sourceMappingURL=index.js.map",
    );

    const result = runGuard(dist);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("sourceMappingURL");
    expect(result.stdout).toContain("index.js");
  });
});
