import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface V2PaperThemeIssue {
  file: string;
  detail: string;
}

interface CheckV2PaperThemeOptions {
  rootDir?: string;
}

const REQUIRED_TEXT: Array<{ file: string; text: string; detail: string }> = [
  {
    file: "src/pages/nav-v2/OrbPage.tsx",
    text: "<CosmicBgAdapter />",
    detail: "OrbPage must let CosmicBgAdapter auto-select day/night by theme.",
  },
  {
    file: "src/pages/nav-v2/OrbPage.tsx",
    text: "isPaperTheme ? <OrbDayFlourish /> : <ShootingStar />",
    detail: "OrbPage must reserve the falling star for dark themes and use a daylight flourish in paper.",
  },
  {
    file: "src/pages/nav-v2/DayCosmicBackground.css",
    text: "--day-solar-core",
    detail: "Day paper background must have its own solar prism color system, not a white page fallback.",
  },
  {
    file: "src/pages/nav-v2/DayCosmicBackground.css",
    text: ".day-cosmic__base::before",
    detail: "Day paper background must include a centered solar halo layer.",
  },
  {
    file: "src/pages/nav-v2/DayCosmicBackground.css",
    text: ".day-cosmic__solar-portal",
    detail: "Day Orb background must include a distinct solar portal, not only a pale gradient.",
  },
  {
    file: "src/pages/nav-v2/DayCosmicBackground.css",
    text: ".day-cosmic__prism-ribbon",
    detail: "Day Orb background must include a daytime motion event instead of copying the night meteor.",
  },
  {
    file: "src/pages/nav-v2/DayCosmicBackground.css",
    text: ".day-cosmic__sun-shower",
    detail: "Day Orb background must include a visible sun-shower layer, not only a blurred orb halo.",
  },
  {
    file: "src/pages/nav-v2/DayCosmicBackground.css",
    text: ".day-cosmic__horizon-glow",
    detail: "Day Orb background must include a rear horizon glow so paper mode is a scene, not a flat bright page.",
  },
  {
    file: "src/pages/nav-v2/DayCosmicBackground.css",
    text: ".day-cosmic__light-curtain",
    detail: "Day Orb background must include daylight curtain motion instead of night shooting stars.",
  },
  {
    file: "src/pages/nav-v2/DayCosmicBackground.tsx",
    text: "day-cosmic__sun-thread",
    detail: "Day Orb background must render deterministic sun threads for a rich rear scene.",
  },
  {
    file: "src/pages/nav-v2/DayCosmicBackground.css",
    text: ".day-cosmic__photon-field",
    detail: "Day Orb background must include a dense daylight particle field to match the night star-field impact.",
  },
  {
    file: "src/pages/nav-v2/DayCosmicBackground.css",
    text: "day-cosmic-photon-twinkle",
    detail: "Daylight particles must have their own twinkle motion signature.",
  },
  {
    file: "src/pages/nav-v2/DayCosmicBackground.css",
    text: ".orb-day-scope .orb-page-rim-glow::before",
    detail: "Paper Orb must have a strong hero-level daylight corona around the real orb.",
  },
  {
    file: "src/pages/nav-v2/OrbPageSteps.tsx",
    text: '"--orb-hero-size": `${heroOrbSize}px`',
    detail: "Paper Orb effects must adapt to the real rendered orb size.",
  },
  {
    file: "src/pages/nav-v2/OrbPageSteps.tsx",
    text: 'className="orb-day-anchor-field"',
    detail: "Paper Orb must include an effect field anchored inside the orb wrapper.",
  },
  {
    file: "src/pages/nav-v2/DayCosmicBackground.css",
    text: ".orb-day-scope .orb-day-anchor-field",
    detail: "Paper Orb anchored field must be styled relative to the orb, not fixed to the viewport.",
  },
  {
    file: "src/pages/nav-v2/DayCosmicBackground.css",
    text: "orb-day-solar-breathe",
    detail: "Day Orb flourish must have a daylight motion signature, not a static pale background.",
  },
  {
    file: "src/pages/nav-v2/habits/HabitCreateSheet.tsx",
    text: 'data-surface="habit-create-sheet"',
    detail: "Habit create sheet needs a paper-theme surface marker.",
  },
  {
    file: "src/pages/nav-v2/habits/hero/HeroEmptyJourney.tsx",
    text: 'data-surface="ink-paper"',
    detail: "Habit empty state needs the paper override surface marker.",
  },
  {
    file: "src/pages/nav-v2/habits/hero/HeroTemplateLibrarySheet.tsx",
    text: 'data-surface="ritual-library-deck"',
    detail: "Habit library sheet needs the paper override surface marker.",
  },
  {
    file: "src/components/NotFoundPage.tsx",
    text: 'data-surface="v2-not-found"',
    detail: "404 must be theme-aware in paper mode.",
  },
  {
    file: "src/styles/themes.css",
    text: '[data-surface="ink-paper"]',
    detail: "Theme CSS must include the habit empty-state paper override.",
  },
  {
    file: "src/styles/themes.css",
    text: '[data-surface="ritual-library-deck"]',
    detail: "Theme CSS must include the habit library paper override.",
  },
  {
    file: "src/styles/themes.css",
    text: '[data-surface="habit-create-sheet"]',
    detail: "Theme CSS must include the habit create sheet paper override.",
  },
  {
    file: "src/styles/themes.css",
    text: '[data-surface="v2-not-found"]',
    detail: "Theme CSS must include the 404 paper override.",
  },
  {
    file: "src/features/journal/useJournalEditorState.ts",
    text: "getDefaultEditorTheme",
    detail: "Journal editor defaults must resolve from the app theme.",
  },
  {
    file: "src/features/journal/JournalEntryList.tsx",
    text: 'data-surface={isPaperTheme ? "journal-memory-paper" : "journal-memory-night"}',
    detail: "Journal memory backdrop must switch day/night by theme.",
  },
  {
    file: "src/features/journal/JournalEntryList.tsx",
    text: "journal-memory-field--paper",
    detail: "Journal paper theme needs a daylight memory backdrop, not the night image scene.",
  },
  {
    file: "src/features/journal/JournalEntryList.tsx",
    text: "const fallbackCover = isPaperTheme",
    detail: "Journal space thumbnails must avoid the night aurora fallback in paper mode.",
  },
  {
    file: "src/features/journal/JournalEntryList.tsx",
    text: "const createShortcutBackground = isPaperTheme",
    detail: "Journal create-space shortcut must avoid the night aurora fallback in paper mode.",
  },
];

const FORBIDDEN_TEXT: Array<{ file: string; text: string; detail: string }> = [
  {
    file: "src/pages/nav-v2/OrbPage.tsx",
    text: 'variant="starry"',
    detail: "OrbPage cannot force the dark starry background in paper mode.",
  },
  {
    file: "src/pages/nav-v2/DayCosmicBackground.css",
    text: "--day-base: hsl(var(--background));",
    detail: "Day paper background cannot mirror the generic page background; that caused white-screen paper mode.",
  },
  {
    file: "src/pages/nav-v2/SettingsPage.tsx",
    text: "placeholder shell",
    detail: "Settings V2 cannot remain a placeholder.",
  },
  {
    file: "src/pages/nav-v2/SettingsPage.tsx",
    text: "settings-page-placeholder-card",
    detail: "Settings V2 should render real control sections, not the old placeholder card.",
  },
  {
    file: "src/features/journal/useJournalEditorState.ts",
    text: 'entry?.theme || "dark"',
    detail: "Journal editor cannot default every entry to the dark theme.",
  },
  {
    file: "src/features/journal/useJournalEditorState.ts",
    text: 'entry?.paperColor || "dark"',
    detail: "Journal editor cannot default paper mode to the dark sheet.",
  },
  {
    file: "src/features/journal/useJournalEditorState.ts",
    text: 'entry?.inkColor || "#ffffff"',
    detail: "Journal editor cannot default paper mode to white ink.",
  },
];

function readProjectFile(rootDir: string, file: string): string | null {
  const path = join(rootDir, file);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

export function findV2PaperThemeIssues({
  rootDir = process.cwd(),
}: CheckV2PaperThemeOptions = {}): V2PaperThemeIssue[] {
  const issues: V2PaperThemeIssue[] = [];

  for (const requirement of REQUIRED_TEXT) {
    const source = readProjectFile(rootDir, requirement.file);
    if (source === null || !source.includes(requirement.text)) {
      issues.push({
        file: requirement.file,
        detail: requirement.detail,
      });
    }
  }

  for (const forbidden of FORBIDDEN_TEXT) {
    const source = readProjectFile(rootDir, forbidden.file);
    if (source !== null && source.includes(forbidden.text)) {
      issues.push({
        file: forbidden.file,
        detail: forbidden.detail,
      });
    }
  }

  return issues;
}

function main(): void {
  const issues = findV2PaperThemeIssues();
  if (issues.length === 0) {
    console.log("V2 paper theme guard passed.");
    return;
  }

  console.error("V2 paper theme guard failed:");
  for (const issue of issues) {
    console.error(`- ${issue.file}: ${issue.detail}`);
  }
  process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
