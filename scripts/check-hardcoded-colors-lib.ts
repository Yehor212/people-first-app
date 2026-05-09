import * as fs from "fs";
import * as path from "path";

export const FILE_EXTENSIONS = [".tsx", ".ts"];

// Files allowed to have hardcoded colors because they define intentional art,
// renderers, or theme registries rather than generic app surfaces.
export const ALLOWED_FILES = [
  "index.css",
  "emotionConstants.ts",
  "tailwind.config.ts",
  "App.css",
  // SVG animation components - colors are essential for animation gradients
  "AnimatedEmotionEmoji.tsx",
  "AnimatedMoodEmoji.tsx",
  "BreathingExercise.tsx",
  // Score-based dynamic colors (SVG limitations)
  "WeekCrystal.tsx",
  // Share card/story slides - designed for image export with fixed branding colors
  "shareCards.ts",
  "ShareModal.tsx",
  "ShareProgress.tsx",
  "stories/",
  // Intentional visual language registries / renderers
  "diaryBgPatterns.ts",
  "orbRenderer.ts",
  "EmotionThemeContext.tsx",
  "weatherMoodConfig.ts",
  "warmEmojis.tsx",
  "coolEmojis.tsx",
  // Visual systems / decorative data renderers with intentional fixed palettes
  "components/icons/",
  "components/mood-emoji/",
  "components/animated-emotion-emoji/",
  "components/stats/",
  "components/breathing-exercise/",
  "components/canvas/",
  "components/leaderboard/",
  "components/habit-completion-celebration/",
  "components/compact-habit-card/",
  "lib/progressStories.ts",
  "lib/seasonalEvents.ts",
  "components/state-of-mind/colorUtils.ts",
  "pages/nav-v2/DayCosmicBackground.tsx",
  // Cinematic/immersive schedule and challenge views where fixed gradients are the feature
  "components/schedule/ScheduleVisuals.tsx",
  "components/schedule/ScheduleTimeline.tsx",
  "components/schedule/TimelineDayColumn.tsx",
  "components/schedule/EventDetailsModal.tsx",
  "components/schedule/AddEventModal.tsx",
  "components/challenges/ParticipantsLeaderboard.tsx",
  "components/challenges/CreateChallengeView.tsx",
  "components/challenges/ChallengeCard.tsx",
  "components/challenges/ChallengeDetailsView.tsx",
  "components/ChallengeModal.tsx",
  "components/StreakBanner.tsx",
  "components/StreakCelebration.tsx",
  "components/ProgressStoriesViewer.tsx",
  "components/auth-screen/AuthScreen.tsx",
  // Journal visual-authoring modules with intentional paper/theme palettes
  "features/journal/types.ts",
  "features/journal/useDiaryCanvas.ts",
  "features/journal/GratitudeBloomWidget.tsx",
  "features/journal/BurnThoughtWidget.tsx",
  "features/journal/JournalStats.tsx",
  "features/journal/JournalLockScreen.tsx",
  "features/journal/DiaryBreatheWidget.tsx",
  "features/journal/DiaryEmptyCanvas.tsx",
  "features/journal/DiaryFormatToolbar.tsx",
  "features/journal/JournalEntryCard.tsx",
  "features/journal/JournalEntryEditor.tsx",
  "features/journal/JournalModule.tsx",
  // Non-UI telemetry color literals are benign
  "observability/reportWebVitals.ts",
];

export const TEST_FILE_PATTERNS = [
  /[/\\]__tests__[/\\]/,
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
];

export const COLOR_PATTERNS = [
  { pattern: /#[a-fA-F0-9]{6}\b/g, name: "hex6" },
  { pattern: /#[a-fA-F0-9]{3}\b/g, name: "hex3" },
  { pattern: /rgba?\s*\([^)]+\)/g, name: "rgb/rgba" },
  { pattern: /hsla?\s*\([^)]+\)/g, name: "hsl/hsla" },
];

export const EXCLUDE_PATTERNS = [
  /hsla?\s*\(\s*var\s*\([^)]+\)[^)]*\)/g,
  /hsl\s*\(\s*var\s*\(\s*--[^)]+\s*\)\s*(?:\/\s*[\d.]+\s*)?\)/g,
  /var\s*\(\s*--[^)]+\)/g,
  /hsla?\s*\(\s*0\s+0%\s+(?:100|0)%[^)]*\)/g,
  /\/\/.*$/gm,
  /\/\*[\s\S]*?\*\//g,
  /['"`]#[a-fA-F0-9]{6}['"`]/g,
  /currentColor/gi,
];

export interface Violation {
  file: string;
  line: number;
  column: number;
  match: string;
  type: string;
}

export interface FileReport {
  file: string;
  violations: Violation[];
}

export interface ColorCheckResult {
  reports: FileReport[];
  totalViolations: number;
  filesScanned: number;
}

export function getAllFiles(dir: string, extensions: string[] = FILE_EXTENSIONS): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!["node_modules", "dist", ".git", "coverage"].includes(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

export function isAllowedFile(filePath: string): boolean {
  const fileName = path.basename(filePath);
  const normalizedPath = filePath.replace(/\\/g, "/");

  return ALLOWED_FILES.some(
    (allowed) =>
      fileName === allowed ||
      normalizedPath.includes(allowed) ||
      (allowed.endsWith("/") && normalizedPath.includes(allowed.slice(0, -1))),
  );
}

export function isTestLikeFile(filePath: string): boolean {
  return TEST_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

export function checkFile(filePath: string): Violation[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const violations: Violation[] = [];

  let cleanedContent = content;
  for (const excludePattern of EXCLUDE_PATTERNS) {
    cleanedContent = cleanedContent.replace(excludePattern, (match) => " ".repeat(match.length));
  }

  for (const { pattern, name } of COLOR_PATTERNS) {
    let match: RegExpExecArray | null;
    const regex = new RegExp(pattern.source, pattern.flags);

    while ((match = regex.exec(cleanedContent)) !== null) {
      const index = match.index;

      let line = 1;
      let lastNewline = -1;
      for (let i = 0; i < index; i++) {
        if (content[i] === "\n") {
          line++;
          lastNewline = i;
        }
      }
      const column = index - lastNewline;

      const lineContent = lines[line - 1] || "";
      if (lineContent.includes("className") && !lineContent.includes("style=")) {
        const beforeMatch = cleanedContent.substring(Math.max(0, index - 10), index);
        if (beforeMatch.includes("[")) {
          violations.push({
            file: filePath,
            line,
            column,
            match: match[0],
            type: `${name} (Tailwind arbitrary)`,
          });
          continue;
        }
      }

      violations.push({
        file: filePath,
        line,
        column,
        match: match[0],
        type: name,
      });
    }
  }

  return violations;
}

export function runColorCheck(srcDir: string, extensions: string[] = FILE_EXTENSIONS): ColorCheckResult {
  const files = getAllFiles(srcDir, extensions);
  const reports: FileReport[] = [];
  let totalViolations = 0;

  for (const file of files) {
    if (isAllowedFile(file) || isTestLikeFile(file)) {
      continue;
    }

    const violations = checkFile(file);
    if (violations.length > 0) {
      const relativePath = path.relative(process.cwd(), file);
      reports.push({ file: relativePath, violations });
      totalViolations += violations.length;
    }
  }

  reports.sort((a, b) => b.violations.length - a.violations.length);

  return {
    reports,
    totalViolations,
    filesScanned: files.length,
  };
}
