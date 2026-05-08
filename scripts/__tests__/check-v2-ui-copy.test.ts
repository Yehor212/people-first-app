import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findV2UiCopyIssues } from "../check-v2-ui-copy";

describe("check-v2-ui-copy", () => {
  it("flags English UI fallback strings in V2-scanned files", () => {
    const root = mkdtempSync(join(tmpdir(), "v2-copy-"));
    const srcDir = join(root, "src/pages/nav-v2/habits");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "BadCopy.tsx"),
      'export function BadCopy({ t }: any) { return <button>{t.habitDurationOngoing || "Ongoing"}</button>; }',
    );

    const issues = findV2UiCopyIssues({ rootDir: root });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.text).toBe("Ongoing");
  });

  it("allows localized key access without English fallback text", () => {
    const root = mkdtempSync(join(tmpdir(), "v2-copy-"));
    const srcDir = join(root, "src/pages/nav-v2/habits");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "GoodCopy.tsx"),
      "export function GoodCopy({ t }: any) { return <button>{t.habitDurationOngoing}</button>; }",
    );

    expect(findV2UiCopyIssues({ rootDir: root })).toEqual([]);
  });
});
