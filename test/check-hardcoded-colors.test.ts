// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

import { checkFile, isAllowedFile, runColorCheck } from "../scripts/check-hardcoded-colors-lib";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("check-hardcoded-colors allowlist", () => {
  it("treats intentional palette registries and art renderers as allowed", () => {
    expect(
      isAllowedFile("C:/project/people-first-app/src/features/journal/diaryBgPatterns.ts"),
    ).toBe(true);
    expect(
      isAllowedFile("C:/project/people-first-app/src/components/state-of-mind/orbRenderer.ts"),
    ).toBe(true);
    expect(
      isAllowedFile("C:/project/people-first-app/src/contexts/EmotionThemeContext.tsx"),
    ).toBe(true);
    expect(
      isAllowedFile("C:/project/people-first-app/src/lib/weatherMoodConfig.ts"),
    ).toBe(true);
    expect(
      isAllowedFile("C:/project/people-first-app/src/components/animated-emotion-emoji/warmEmojis.tsx"),
    ).toBe(true);
    expect(
      isAllowedFile("C:/project/people-first-app/src/components/animated-emotion-emoji/coolEmojis.tsx"),
    ).toBe(true);
    expect(
      isAllowedFile("C:/project/people-first-app/src/components/leaderboard/types.ts"),
    ).toBe(true);
    expect(
      isAllowedFile("C:/project/people-first-app/src/components/stats/DataMountains.tsx"),
    ).toBe(true);
    expect(
      isAllowedFile("C:/project/people-first-app/src/components/breathing-exercise/types.ts"),
    ).toBe(true);
    expect(
      isAllowedFile("C:/project/people-first-app/src/components/schedule/ScheduleVisuals.tsx"),
    ).toBe(true);
    expect(
      isAllowedFile("C:/project/people-first-app/src/features/journal/JournalEntryEditor.tsx"),
    ).toBe(true);
    expect(
      isAllowedFile("C:/project/people-first-app/src/components/Button.tsx"),
    ).toBe(false);
    expect(
      isAllowedFile("C:/project/people-first-app/src/components/settings/ProfileSection.tsx"),
    ).toBe(false);
  });

  it("still flags hardcoded rgba colors in regular components", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hardcoded-colors-"));
    tempDirs.push(tempDir);

    const file = path.join(tempDir, "RegularCard.tsx");
    fs.writeFileSync(
      file,
      [
        "export function RegularCard() {",
        "  return <div style={{ color: 'rgba(1, 2, 3, 0.4)' }}>demo</div>;",
        "}",
      ].join("\n"),
      "utf8",
    );

    const violations = checkFile(file);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      file,
      line: 2,
      match: "rgba(1, 2, 3, 0.4)",
      type: "rgb/rgba",
    });
  });

  it("does not flag hsl(var(--token)) theme usage", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hardcoded-colors-vars-"));
    tempDirs.push(tempDir);

    const file = path.join(tempDir, "ThemedCard.tsx");
    fs.writeFileSync(
      file,
      [
        "export function ThemedCard() {",
        "  return <div className=\"from-[hsl(var(--insight-mood))]/20 border-[hsl(var(--insight-mood))]/30\" />;",
        "}",
      ].join("\n"),
      "utf8",
    );

    expect(checkFile(file)).toHaveLength(0);
  });

  it("skips test files when scanning a directory", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hardcoded-colors-run-"));
    tempDirs.push(tempDir);

    fs.mkdirSync(path.join(tempDir, "__tests__"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, "__tests__", "IgnoredCard.test.tsx"),
      "export const ignored = 'rgba(255, 0, 0, 0.5)';\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(tempDir, "RegularCard.tsx"),
      "export const visible = 'rgba(1, 2, 3, 0.4)';\n",
      "utf8",
    );

    const result = runColorCheck(tempDir);

    expect(result.totalViolations).toBe(1);
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0].file).toContain("RegularCard.tsx");
  });
});
