import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("package Vitest script isolation", () => {
  it("keeps generated output trees outside repository-wide Vitest discovery", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8")
    ) as { scripts?: Record<string, string> };
    const discoveryScripts = ["test", "test:coverage"];
    const unsafeScripts = discoveryScripts.filter((name) => {
      const command = packageJson.scripts?.[name] ?? "";
      return !/\bvitest\s+run\b/.test(command) ||
        !/--exclude\s+(["'])output\/\*\*\1/.test(command);
    });

    expect(unsafeScripts).toEqual([]);
  });

  it("keeps local recovery copies outside every Vitest discovery path", () => {
    const config = readFileSync(
      resolve(process.cwd(), "vitest.config.ts"),
      "utf8"
    );

    expect(config).toContain('".codex-recovery/**"');
  });
});
