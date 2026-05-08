import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { findV2PaperThemeIssues } from "../check-v2-paper-theme";

function writeFixture(root: string, file: string, source: string) {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
}

function createPassingFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "v2-paper-"));
  writeFixture(
    root,
    "src/pages/nav-v2/OrbPage.tsx",
    "<CosmicBgAdapter />\nisPaperTheme ? <OrbDayFlourish /> : <ShootingStar />",
  );
  writeFixture(
    root,
    "src/pages/nav-v2/OrbPageSteps.tsx",
    '"--orb-hero-size": `${heroOrbSize}px`\nclassName="orb-day-anchor-field"',
  );
  writeFixture(
    root,
    "src/pages/nav-v2/DayCosmicBackground.css",
    [
      "--day-solar-core: hsl(38 92% 72% / 0.66);",
      ".day-cosmic__base::before {}",
      ".day-cosmic__solar-portal {}",
      ".day-cosmic__prism-ribbon {}",
      ".day-cosmic__sun-shower {}",
      ".day-cosmic__horizon-glow {}",
      ".day-cosmic__light-curtain {}",
      ".day-cosmic__photon-field {}",
      "@keyframes day-cosmic-photon-twinkle {}",
      ".orb-day-scope .orb-page-rim-glow::before {}",
      ".orb-day-scope .orb-day-anchor-field {}",
      "@keyframes orb-day-solar-breathe {}",
    ].join("\n"),
  );
  writeFixture(
    root,
    "src/pages/nav-v2/DayCosmicBackground.tsx",
    '<span className="day-cosmic__sun-thread" />',
  );
  writeFixture(
    root,
    "src/pages/nav-v2/habits/HabitCreateSheet.tsx",
    '<div data-surface="habit-create-sheet" />',
  );
  writeFixture(
    root,
    "src/pages/nav-v2/habits/hero/HeroEmptyJourney.tsx",
    '<div data-surface="ink-paper" />',
  );
  writeFixture(
    root,
    "src/pages/nav-v2/habits/hero/HeroTemplateLibrarySheet.tsx",
    '<div data-surface="ritual-library-deck" />',
  );
  writeFixture(root, "src/components/NotFoundPage.tsx", '<main data-surface="v2-not-found" />');
  writeFixture(
    root,
    "src/styles/themes.css",
    [
      '[data-surface="ink-paper"]{}',
      '[data-surface="ritual-library-deck"]{}',
      '[data-surface="habit-create-sheet"]{}',
      '[data-surface="v2-not-found"]{}',
    ].join("\n"),
  );
  writeFixture(
    root,
    "src/features/journal/useJournalEditorState.ts",
    "function getDefaultEditorTheme() {}",
  );
  writeFixture(
    root,
    "src/features/journal/JournalEntryList.tsx",
    [
      'data-surface={isPaperTheme ? "journal-memory-paper" : "journal-memory-night"}',
      "journal-memory-field--paper",
      "const fallbackCover = isPaperTheme",
      "const createShortcutBackground = isPaperTheme",
    ].join("\n"),
  );
  writeFixture(root, "src/pages/nav-v2/SettingsPage.tsx", "export function SettingsPage() {}");
  return root;
}

describe("check-v2-paper-theme", () => {
  it("passes when the required paper-theme anchors are present", () => {
    expect(findV2PaperThemeIssues({ rootDir: createPassingFixture() })).toEqual([]);
  });

  it("flags old dark defaults and forced starry Orb backgrounds", () => {
    const root = createPassingFixture();
    writeFixture(root, "src/pages/nav-v2/OrbPage.tsx", '<CosmicBgAdapter variant="starry" />');
    writeFixture(
      root,
      "src/pages/nav-v2/DayCosmicBackground.css",
      "--day-base: hsl(var(--background));",
    );
    writeFixture(root, "src/pages/nav-v2/DayCosmicBackground.tsx", "export function DayCosmicBackground() {}");
    writeFixture(root, "src/pages/nav-v2/OrbPageSteps.tsx", "export function OrbSelectStep() {}");
    writeFixture(
      root,
      "src/features/journal/useJournalEditorState.ts",
      'const theme = entry?.theme || "dark";',
    );

    const issues = findV2PaperThemeIssues({ rootDir: root });
    expect(issues.map((issue) => issue.detail)).toEqual(
      expect.arrayContaining([
        "OrbPage must let CosmicBgAdapter auto-select day/night by theme.",
        "OrbPage cannot force the dark starry background in paper mode.",
        "OrbPage must reserve the falling star for dark themes and use a daylight flourish in paper.",
        "Day paper background must have its own solar prism color system, not a white page fallback.",
        "Day paper background must include a centered solar halo layer.",
        "Day Orb background must include a distinct solar portal, not only a pale gradient.",
        "Day Orb background must include a daytime motion event instead of copying the night meteor.",
        "Day Orb background must include a visible sun-shower layer, not only a blurred orb halo.",
        "Day Orb background must include a rear horizon glow so paper mode is a scene, not a flat bright page.",
        "Day Orb background must include daylight curtain motion instead of night shooting stars.",
        "Day Orb background must render deterministic sun threads for a rich rear scene.",
        "Day Orb background must include a dense daylight particle field to match the night star-field impact.",
        "Daylight particles must have their own twinkle motion signature.",
        "Paper Orb must have a strong hero-level daylight corona around the real orb.",
        "Paper Orb effects must adapt to the real rendered orb size.",
        "Paper Orb must include an effect field anchored inside the orb wrapper.",
        "Paper Orb anchored field must be styled relative to the orb, not fixed to the viewport.",
        "Day Orb flourish must have a daylight motion signature, not a static pale background.",
        "Day paper background cannot mirror the generic page background; that caused white-screen paper mode.",
        "Journal editor defaults must resolve from the app theme.",
        "Journal editor cannot default every entry to the dark theme.",
      ]),
    );
  });
});
