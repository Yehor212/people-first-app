import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = "src";
const CLASS_CONSTRAINT_TOKEN = /\b(?:truncate|line-clamp-[0-9]+|whitespace-nowrap|break-all)\b/g;

type ConstraintToken =
  | "truncate"
  | `line-clamp-${number}`
  | "whitespace-nowrap"
  | "css-nowrap"
  | "css-ellipsis"
  | "css-line-clamp"
  | "manual-ellipsis"
  | "break-all";

interface ConstraintOccurrence {
  path: string;
  token: ConstraintToken;
  anchor: string;
}

interface ApprovedOccurrence extends ConstraintOccurrence {
  reason: string;
  fullValuePath: string;
}

// Exact source anchors are intentional. A safe removal must delete its stale
// approval, and moving the same token to another element must trigger review.
const APPROVED_OCCURRENCES: readonly ApprovedOccurrence[] = [
  {
    path: "src/components/AchievementCard.tsx",
    token: "line-clamp-1",
    anchor: '<h4 className="font-semibold text-sm line-clamp-1">',
    reason: "Bounded achievement-card preview.",
    fullValuePath: "The keyboard/touch-activatable card opens the complete achievement detail.",
  },
  {
    path: "src/components/AchievementCard.tsx",
    token: "line-clamp-2",
    anchor: '<p className="text-xs text-muted-foreground line-clamp-2">',
    reason: "Bounded achievement-card preview.",
    fullValuePath: "The keyboard/touch-activatable card opens the complete achievement detail.",
  },
  {
    path: "src/components/GlobalScheduleBar.tsx",
    token: "truncate",
    anchor: '<span className="text-sm font-medium truncate">',
    reason: "Compact current-event preview inside the global schedule button.",
    fullValuePath: "The containing button opens the complete schedule.",
  },
  {
    path: "src/components/GlobalScheduleBar.tsx",
    token: "truncate",
    anchor: '<span className="text-sm text-muted-foreground truncate">',
    reason: "Compact next-event preview inside the global schedule button.",
    fullValuePath: "The containing button opens the complete schedule.",
  },
  {
    path: "src/components/habit-hub/HabitHubList.tsx",
    token: "whitespace-nowrap",
    anchor:
      '"flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap motion-safe:transition-colors",',
    reason: "Complete filter-chip label in an explicit one-axis chip scroller.",
    fullValuePath: "The complete label is rendered on the chip; the scroller exposes every chip.",
  },
  {
    path: "src/components/habit-tracker/HabitTracker.tsx",
    token: "whitespace-nowrap",
    anchor:
      '"snap-start px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap motion-safe:transition-all flex items-center gap-1 min-h-[44px]",',
    reason: "Complete compact chip in an explicit one-axis chip scroller.",
    fullValuePath: "The chip renders its complete label and remains horizontally reachable.",
  },
  {
    path: "src/components/habit-tracker/HabitTracker.tsx",
    token: "whitespace-nowrap",
    anchor:
      '"snap-start px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap motion-safe:transition-all min-h-[44px]",',
    reason: "Complete compact chip in an explicit one-axis chip scroller.",
    fullValuePath: "The chip renders its complete label and remains horizontally reachable.",
  },
  {
    path: "src/components/schedule/ScheduleVisuals.tsx",
    token: "truncate",
    anchor: '<span className="truncate px-1">{event.title}</span>',
    reason: "Timeline-card preview constrained by the event duration.",
    fullValuePath: "Activating the event card opens the complete event details.",
  },
  {
    path: "src/components/schedule/ScheduleVisuals.tsx",
    token: "whitespace-nowrap",
    anchor:
      'className="min-w-0 max-w-full whitespace-nowrap text-center text-sm font-bold leading-none tracking-tight [font-variant-numeric:tabular-nums] [text-shadow:0_0_10px_rgba(139,92,246,0.5)] md:text-base"',
    reason: "Atomic numeric timer value.",
    fullValuePath: "The complete numeric value is rendered; no user text is shortened.",
  },
  {
    path: "src/components/schedule/TimelineDayColumn.tsx",
    token: "whitespace-nowrap",
    anchor: '"whitespace-nowrap text-sm font-medium tabular-nums",',
    reason: "Atomic complete HH:00 label in the named horizontal timeline.",
    fullValuePath: "Every full label is rendered in a 96px cell and runtime collision proof is required.",
  },
  {
    path: "src/components/WidgetPreview.tsx",
    token: "truncate",
    anchor: "'text-sm flex-1 truncate',",
    reason: "Legacy widget-preview simulation; its Settings entry is currently absent.",
    fullValuePath: "SOURCE_DEFINED_UNREACHABLE; restoring the entry point requires a new reveal-path review.",
  },
  {
    path: "src/components/WidgetPreview.tsx",
    token: "truncate",
    anchor: '<span className="text-sm font-medium truncate" style={WIDGET_ACCENTS.amber.text}>',
    reason: "Legacy widget-preview simulation; its Settings entry is currently absent.",
    fullValuePath: "SOURCE_DEFINED_UNREACHABLE; restoring the entry point requires a new reveal-path review.",
  },
  {
    path: "src/features/journal/JournalEntryCard.tsx",
    token: "line-clamp-2",
    anchor: '<p className="text-xs text-muted-foreground/70 line-clamp-2 leading-relaxed" dir="auto">',
    reason: "Bounded related-entry preview.",
    fullValuePath: "The keyboard/touch-activatable entry card opens the complete journal entry.",
  },
  {
    path: "src/features/journal/JournalModule.tsx",
    token: "line-clamp-3",
    anchor: '<span className="mt-2 block line-clamp-3 text-sm leading-relaxed text-muted-foreground">',
    reason: "Bounded favorite-entry preview.",
    fullValuePath: "Activating the favorite opens the complete journal entry.",
  },
  {
    path: "src/features/journal/JournalPhotoGallery.tsx",
    token: "whitespace-nowrap",
    anchor:
      'className="absolute bottom-[max(1rem,var(--safe-bottom))] left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-3 py-1 text-xs text-white dark:bg-black/80"',
    reason: "Atomic numeric photo-position overlay.",
    fullValuePath: "The complete current/total numeric value is rendered.",
  },
  {
    path: "src/features/journal/MoodDotStrip.tsx",
    token: "manual-ellipsis",
    anchor:
      '<span className="font-medium">{title.length > 24 ? title.slice(0, 24) + "\\u2026" : title}</span>',
    reason: "Bounded hover preview beside a 44px journal dot.",
    fullValuePath: "The full title is in the option accessible name and activating the dot opens the entry.",
  },
  {
    path: "src/features/journal/MoodDotStrip.tsx",
    token: "whitespace-nowrap",
    anchor:
      '"absolute z-50 px-2.5 py-1.5 rounded-lg bg-popover text-popover-foreground text-xs shadow-lg border border-border/30 whitespace-nowrap pointer-events-none backdrop-blur-sm",',
    reason: "Bounded hover preview paired with the reviewed manual ellipsis.",
    fullValuePath: "The full title is in the option accessible name and activating the dot opens the entry.",
  },
  {
    path: "src/features/journal/OnThisDayCard.tsx",
    token: "line-clamp-2",
    anchor: '"text-xs text-muted-foreground mt-0.5 line-clamp-2",',
    reason: "Bounded memory preview inside an entry button.",
    fullValuePath: "Activating the row opens the complete journal entry.",
  },
  {
    path: "src/features/journal/OnThisDayCard.tsx",
    token: "manual-ellipsis",
    anchor: 'return text.slice(0, max).trimEnd() + "…";',
    reason: "Bounded memory preview inside an entry button.",
    fullValuePath: "Activating the row opens the complete journal entry.",
  },
  {
    path: "src/features/journal/memoryPortal.ts",
    token: "manual-ellipsis",
    anchor: 'return text.length > 38 ? `${text.slice(0, 38).trimEnd()}...` : text;',
    reason: "Bounded canvas-node label derived only when an entry has no title.",
    fullValuePath: "Selecting the node opens the complete journal entry.",
  },
  {
    path: "src/lib/exportService.ts",
    token: "manual-ellipsis",
    anchor:
      'addText(`${entry.date}: "${entry.text.slice(0, 100)}${entry.text.length > 100 ? \'...\' : \'\'}"`);',
    reason: "Bounded human-readable PDF summary row.",
    fullValuePath: "Full-fidelity journal export remains available through the structured export path.",
  },
  {
    path: "src/pages/nav-v2/CinematicHeading.css",
    token: "css-nowrap",
    anchor: "white-space: nowrap;",
    reason: "Prevents a single animated word from breaking between its separately animated characters.",
    fullValuePath: "The heading container may wrap between complete words; no characters are removed.",
  },
  {
    path: "src/pages/nav-v2/OrbAmbienceControl.css",
    token: "css-nowrap",
    anchor: "white-space: nowrap;",
    reason: "Standard visually-hidden control state before keyboard focus reveals it.",
    fullValuePath: "The focus-within state explicitly restores normal wrapping and full control text.",
  },
  {
    path: "src/pages/nav-v2/OrbAmbienceControl.tsx",
    token: "truncate",
    anchor: '<span className="hidden max-w-[9rem] truncate sm:inline">',
    reason: "Secondary ambience label in a focus-revealed compact control.",
    fullValuePath: "The complete localized value remains in aria-label and title on the button.",
  },
] as const;

function normalizePath(path: string): string {
  return path.split("\\").join("/");
}

function listProductionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") return [];
      return listProductionSources(absolute);
    }

    if (!/\.(?:ts|tsx|css)$/.test(entry.name)) return [];
    if (/\.(?:test|spec)\.(?:ts|tsx)$/.test(entry.name)) return [];
    return [absolute];
  });
}

function scanCssSource(path: string, source: string): ConstraintOccurrence[] {
  const occurrences: ConstraintOccurrence[] = [];
  for (const line of source.split(/\r?\n/)) {
    const anchor = line.trim();
    const checks: readonly [ConstraintToken, RegExp][] = [
      ["css-nowrap", /white-space\s*:\s*nowrap/],
      ["css-ellipsis", /text-overflow\s*:\s*ellipsis/],
      ["css-line-clamp", /-webkit-line-clamp\s*:/],
      ["break-all", /word-break\s*:\s*break-all/],
    ];
    for (const [token, pattern] of checks) {
      if (pattern.test(line)) occurrences.push({ path, token, anchor });
    }
  }
  return occurrences;
}

function scanTypeScriptSource(path: string, source: string): ConstraintOccurrence[] {
  const occurrences: ConstraintOccurrence[] = [];
  const lines = source.split(/\r?\n/);
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node)) {
      const start = node.getStart(sourceFile);
      const raw = source.slice(start, node.getEnd());
      for (const match of raw.matchAll(CLASS_CONSTRAINT_TOKEN)) {
        const position = start + (match.index ?? 0);
        const { line } = sourceFile.getLineAndCharacterOfPosition(position);
        occurrences.push({
          path,
          token: match[0] as ConstraintToken,
          anchor: lines[line].trim(),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  for (const line of lines) {
    const sliceIndex = line.search(/\b(?:slice|substring|substr)\s*\(/);
    if (sliceIndex < 0) continue;
    const tail = line.slice(sliceIndex);
    if (/(?:…|\\u2026|\.\.\.)/.test(tail)) {
      occurrences.push({ path, token: "manual-ellipsis", anchor: line.trim() });
    }
  }

  return occurrences;
}

function scanSource(path: string, source: string): ConstraintOccurrence[] {
  return path.endsWith(".css")
    ? scanCssSource(path, source)
    : scanTypeScriptSource(path, source);
}

function fingerprint(occurrence: ConstraintOccurrence): string {
  return `${occurrence.path}\u0000${occurrence.token}\u0000${occurrence.anchor}`;
}

function sortedFingerprints(occurrences: readonly ConstraintOccurrence[]): string[] {
  return occurrences.map(fingerprint).sort();
}

function collectProductionOccurrences(): ConstraintOccurrence[] {
  return listProductionSources(SOURCE_ROOT).flatMap((absolute) => {
    const path = normalizePath(relative(".", absolute));
    return scanSource(path, readFileSync(absolute, "utf8"));
  });
}

describe("intentional single-line text contract", () => {
  it("rejects relocating an approved clipping token to a different element", () => {
    const path = "src/components/schedule/ScheduleVisuals.tsx";
    const source = readFileSync(path, "utf8");
    const relocated = source
      .replace('className="truncate px-1"', 'className="px-1"')
      .replace(
        'className="relative h-20 w-20 shrink-0"',
        'className="relative h-20 w-20 shrink-0 truncate"',
      );
    const approved = APPROVED_OCCURRENCES.filter((entry) => entry.path === path);

    expect(sortedFingerprints(scanSource(path, relocated))).not.toEqual(
      sortedFingerprints(approved),
    );
  });

  it("detects CSS nowrap and manual ellipsis mutations", () => {
    expect(scanCssSource("src/example.css", ".label { white-space: nowrap; }")).toEqual([
      {
        path: "src/example.css",
        token: "css-nowrap",
        anchor: ".label { white-space: nowrap; }",
      },
    ]);
    expect(
      scanTypeScriptSource(
        "src/example.ts",
        'const preview = text.slice(0, 12) + "…";',
      ),
    ).toContainEqual({
      path: "src/example.ts",
      token: "manual-ellipsis",
      anchor: 'const preview = text.slice(0, 12) + "…";',
    });
  });

  it("does not confuse a helper named truncate with a clipping utility", () => {
    const path = "src/features/journal/OnThisDayCard.tsx";
    const occurrences = scanSource(path, readFileSync(path, "utf8"));

    expect(occurrences.filter((entry) => entry.token === "truncate")).toEqual([]);
  });

  it("requires an exact, documented approval for every production occurrence", () => {
    const observed = collectProductionOccurrences();

    expect(APPROVED_OCCURRENCES.every((entry) => entry.reason.trim().length > 0)).toBe(true);
    expect(
      APPROVED_OCCURRENCES.every((entry) => entry.fullValuePath.trim().length > 0),
    ).toBe(true);
    expect(observed.filter((entry) => entry.token === "break-all")).toEqual([]);
    expect(sortedFingerprints(observed)).toEqual(sortedFingerprints(APPROVED_OCCURRENCES));
  });
});
