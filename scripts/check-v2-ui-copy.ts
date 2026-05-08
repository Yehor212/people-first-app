import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export interface V2UiCopyIssue {
  file: string;
  line: number;
  text: string;
  source: string;
}

interface FindV2UiCopyIssuesOptions {
  rootDir?: string;
}

const SCAN_DIRS = [
  "src/pages/nav-v2",
  "src/components/navigation-v2",
  "src/components/habit-creation-form",
] as const;

const SKIP_FILE_PATTERN = /(?:\.test|\.spec|\.stories|\.mock)\.(?:ts|tsx)$/;
const SKIP_V2_ORB_PATTERN = /src\/pages\/nav-v2\/(?:Mood|Orb)/;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const FALLBACK_PATTERN = /(?:\|\||\?\?)\s*(["'`])([^"'`]+)\1/g;

const DISALLOWED_VISIBLE_FALLBACKS = new Set([
  "Advanced",
  "At Most",
  "Back",
  "Cancel",
  "Create custom habit",
  "Duration",
  "Edit",
  "Edit Habit",
  "Enter habit name...",
  "Essentials",
  "Habit name",
  "Ongoing",
  "Preview",
  'Question (e.g., "Did you exercise today?")',
  "Quick Add",
  "Save Changes",
  "Set days",
  "Settings",
  "Template",
  "Tracking question",
  "Useful for 7-day resets, 30-day experiments, or quit programs.",
]);

function isSourceFile(path: string): boolean {
  return SOURCE_EXTENSIONS.has(path.slice(path.lastIndexOf("."))) && !SKIP_FILE_PATTERN.test(path);
}

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      collectSourceFiles(path, files);
      continue;
    }
    if (stat.isFile() && isSourceFile(path)) {
      files.push(path);
    }
  }

  return files;
}

function lineNumberAt(source: string, index: number): number {
  let line = 1;
  for (let position = 0; position < index; position += 1) {
    if (source.charCodeAt(position) === 10) line += 1;
  }
  return line;
}

export function findV2UiCopyIssues({
  rootDir = process.cwd(),
}: FindV2UiCopyIssuesOptions = {}): V2UiCopyIssue[] {
  const issues: V2UiCopyIssue[] = [];
  const files = SCAN_DIRS.flatMap((dir) => collectSourceFiles(join(rootDir, dir)));

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    FALLBACK_PATTERN.lastIndex = 0;

    for (const match of source.matchAll(FALLBACK_PATTERN)) {
      const relativeFile = relative(rootDir, file).replace(/\\/g, "/");
      if (SKIP_V2_ORB_PATTERN.test(relativeFile)) continue;
      const text = match[2];
      if (!text || !DISALLOWED_VISIBLE_FALLBACKS.has(text)) continue;

      issues.push({
        file: relativeFile,
        line: lineNumberAt(source, match.index ?? 0),
        text,
        source: match[0],
      });
    }
  }

  return issues;
}

function main(): void {
  const issues = findV2UiCopyIssues();
  if (issues.length === 0) {
    console.log("V2 UI copy guard passed: no disallowed English fallbacks found.");
    return;
  }

  console.error("V2 UI copy guard failed:");
  for (const issue of issues) {
    console.error(`- ${issue.file}:${issue.line} ${issue.source}`);
  }
  process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
