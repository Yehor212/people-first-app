import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const sources = {
  create: read("src/components/challenges/CreateChallengeView.tsx"),
  card: read("src/components/challenges/ChallengeCard.tsx"),
  modal: read("src/components/ChallengeModal.tsx"),
  selectedDay: read("src/components/stats/SelectedDayPanel.tsx"),
};

describe("challenge and selected-day user text reflow contract", () => {
  it("lets the habit preview and create action grow without removing decorative clipping", () => {
    expect(sources.create).toContain(
      'className="flex min-w-0 items-center gap-4 p-4 rounded-2xl overflow-hidden relative',
    );
    expect(sources.create).toContain('className="text-5xl shrink-0 p-3');
    expect(sources.create).toContain('<div className="min-w-0 flex-1">');
    expect(sources.create).toContain(
      'className="min-w-0 break-words font-semibold text-slate-800 dark:text-white text-lg [overflow-wrap:anywhere]"',
    );
    expect(sources.create).toContain(
      '"relative w-full h-auto min-h-14 min-w-0 overflow-hidden rounded-xl px-4 py-3 font-semibold text-lg text-white"',
    );
    expect(sources.create).toContain(
      'className="relative z-10 flex min-w-0 flex-wrap items-center justify-center gap-2 whitespace-normal break-words text-center [hyphens:manual] [overflow-wrap:break-word]"',
    );
    expect(sources.create).toContain('className="w-5 h-5 shrink-0"');
  });

  it("gives challenge habit and creator text shrinkable tracks inside the clipped card", () => {
    expect(sources.card).toContain(
      '"relative w-full min-w-0 p-4 rounded-2xl text-start overflow-hidden"',
    );
    expect(sources.card).toContain(
      'className="flex min-w-0 items-start justify-between gap-3 ps-2"',
    );
    expect(sources.card).toContain(
      'className="flex min-w-0 flex-1 items-center gap-3"',
    );
    expect(sources.card).toContain('className="min-w-0 flex-1"');
    expect(sources.card).toContain(
      'className="min-w-0 break-words font-medium text-slate-800 dark:text-white [overflow-wrap:anywhere]"',
    );
    expect(sources.card).toContain(
      'className="min-w-0 break-words text-xs text-slate-500 dark:text-white/60 [overflow-wrap:anywhere]"',
    );
    expect(sources.card).toContain(
      'className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5"',
    );
  });

  it("keeps the challenge modal heading on a shrinkable wrapping track", () => {
    expect(sources.modal).toContain(
      'className="flex min-w-0 items-center justify-between p-4 border-b',
    );
    expect(sources.modal).toContain(
      'className="flex min-w-0 flex-1 items-center gap-3 relative z-10"',
    );
    expect(sources.modal).toContain("min-h-11 min-w-11 shrink-0");
    expect(sources.modal).toContain(
      'className="w-10 h-10 shrink-0 rounded-xl',
    );
    expect(sources.modal).toContain('<div className="min-w-0 flex-1">');
    expect(sources.modal).toContain(
      'className="min-w-0 break-words font-semibold text-slate-800 dark:text-white [hyphens:manual] [overflow-wrap:break-word]"',
    );
  });

  it("wraps selected-day notes, tags, and habit pills inside the decorative shell", () => {
    expect(sources.selectedDay).toContain(
      'className="mt-5 relative overflow-hidden rounded-2xl',
    );
    expect(sources.selectedDay).toContain(
      'className="mt-2 min-w-0 break-words text-sm text-foreground/70 italic ps-6 [overflow-wrap:anywhere]"',
    );
    expect(sources.selectedDay).toContain(
      'className="max-w-full min-w-0 whitespace-normal break-words px-2 py-0.5 text-xs rounded-full bg-violet-500/20 text-violet-700 dark:text-violet-300 shadow-[0_0_6px_rgba(139,92,246,0.3)] [overflow-wrap:anywhere]"',
    );
    expect(
      sources.selectedDay.match(
        /className="flex max-w-full min-w-0 items-center gap-1\.5 px-2\.5 py-1/g,
      ),
    ).toHaveLength(2);
    expect(
      sources.selectedDay.match(
        /className="min-w-0 break-words text-xs font-medium [^"]+ \[overflow-wrap:anywhere\]"/g,
      ),
    ).toHaveLength(2);
    expect(sources.selectedDay).toContain(
      'className="min-w-0 break-words text-sm text-foreground [overflow-wrap:anywhere]"',
    );
  });
});
