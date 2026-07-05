import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
type TranslationQualityIssue = { ruleId: string };
const { findTranslationQualityIssues } = require("../check-translation-quality.cjs") as {
  findTranslationQualityIssues(options: { rootDir: string }): TranslationQualityIssue[];
};

describe("check-translation-quality", () => {
  it("flags implementation jargon in visible translations and fallback copy", () => {
    const root = mkdtempSync(join(tmpdir(), "translation-quality-"));

    mkdirSync(join(root, "src/i18n/languages"), { recursive: true });
    writeFileSync(
      join(root, "src/i18n/languages/en.ts"),
      'export default { syncStatus: "Cloud sync is paused." };\n',
    );

    mkdirSync(join(root, "src/components"), { recursive: true });
    writeFileSync(
      join(root, "src/components/Status.tsx"),
      'export function Status({ t }: any) { return <p>{t.syncStatus || "Saved locally"}</p>; }\n',
    );

    const issues = findTranslationQualityIssues({ rootDir: root });
    expect(issues.map((issue) => issue.ruleId)).toEqual([
      "internal-sync-jargon",
      "local-storage-jargon",
    ]);
  });

  it("allows calm user-facing account and device wording", () => {
    const root = mkdtempSync(join(tmpdir(), "translation-quality-"));

    mkdirSync(join(root, "src/i18n/languages"), { recursive: true });
    writeFileSync(
      join(root, "src/i18n/languages/en.ts"),
      'export default { syncStatus: "Changes are saved on this device and will update your account when connection returns." };\n',
    );

    mkdirSync(join(root, "src/pages/nav-v2/settings"), { recursive: true });
    writeFileSync(
      join(root, "src/pages/nav-v2/settings/Status.tsx"),
      'export function Status({ t }: any) { return <p>{t.syncStatus ?? "Saved on this device"}</p>; }\n',
    );

    expect(findTranslationQualityIssues({ rootDir: root })).toEqual([]);
  });

  it("ignores non-visible implementation fallback strings", () => {
    const root = mkdtempSync(join(tmpdir(), "translation-quality-"));

    mkdirSync(join(root, "src/i18n/languages"), { recursive: true });
    writeFileSync(join(root, "src/i18n/languages/en.ts"), 'export default { diaryBgCloud: "Cloud" };\n');

    mkdirSync(join(root, "src/components/state-of-mind"), { recursive: true });
    writeFileSync(
      join(root, "src/components/state-of-mind/ValenceOrb.tsx"),
      'recordError(new Error(event.data.reason || "Worker WebGL renderer failed"));\n',
    );

    expect(findTranslationQualityIssues({ rootDir: root })).toEqual([]);
  });
});
