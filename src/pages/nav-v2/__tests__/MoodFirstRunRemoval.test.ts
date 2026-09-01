import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readSource = (path: string) => readFileSync(resolve(root, path), "utf8");

const languageFiles = ["ar", "de", "en", "es", "fr", "he", "ja", "uk"].map(
  (language) => `src/i18n/languages/${language}.ts`
);

describe("removed Orb first-run tutorial", () => {
  it("keeps the tutorial component and stylesheet deleted", () => {
    expect(existsSync(resolve(root, "src/pages/nav-v2/MoodFirstRunHint.tsx"))).toBe(false);
    expect(existsSync(resolve(root, "src/pages/nav-v2/MoodFirstRunHint.css"))).toBe(false);
  });

  it("keeps runtime, storage, styles, and translations free of the retired tutorial", () => {
    const sources = [
      "src/pages/nav-v2/OrbPage.tsx",
      "src/pages/nav-v2/useOrbMoodFlow.ts",
      "src/lib/storageKeys.ts",
      "src/index.css",
      "src/styles/themes.css",
      "src/i18n/types.ts",
      ...languageFiles,
    ].map(readSource);

    for (const source of sources) {
      expect(source).not.toMatch(
        /MoodFirstRunHint|firstRunEligible|mood-first-run|orbFirstRun|ORB_FIRST_RUN_DISMISSED|zenflow-orb-first-run-dismissed/
      );
    }
  });
});
