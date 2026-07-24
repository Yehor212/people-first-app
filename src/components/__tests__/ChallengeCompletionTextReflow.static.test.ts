import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const sources = {
  details: read("src/components/challenges/ChallengeDetailsView.tsx"),
  join: read("src/components/challenges/JoinChallengeView.tsx"),
  celebration: read("src/components/habit-completion-celebration/HabitCompletionCelebration.tsx"),
};

describe("challenge details, invite, and celebration text reflow contract", () => {
  it("keeps the challenge name and competing progress labels inside clipped shells", () => {
    expect(sources.details).toContain(
      'className="relative min-w-0 text-center py-8 rounded-2xl overflow-hidden'
    );
    expect(sources.details).toContain(
      'className="relative z-10 min-w-0 break-words px-4 text-xl font-bold text-slate-800 dark:text-white [overflow-wrap:anywhere]"'
    );
    expect(
      sources.details.match(/className="flex min-w-0 flex-wrap items-start justify-between gap-2/g)
    ).toHaveLength(2);
    expect(sources.details).toContain(
      'className="min-w-0 break-words text-sm font-medium text-slate-800 dark:text-white [hyphens:manual] [overflow-wrap:break-word]"'
    );
    expect(sources.details).toContain(
      'className="flex min-w-0 items-center gap-1 break-words text-slate-500 dark:text-white/60 [hyphens:manual] [overflow-wrap:break-word]"'
    );
  });

  it("stacks or auto-fits localized challenge statistics instead of forcing three columns", () => {
    expect(sources.details).toContain(
      'className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-[repeat(auto-fit,minmax(7rem,1fr))]"'
    );
    expect(
      sources.details.match(
        /className="min-w-0 bg-card rounded-xl p-3 border border-border\/50 text-center"/g
      )
    ).toHaveLength(3);
    expect(
      sources.details.match(
        /className="min-w-0 break-words text-xs text-muted-foreground \[hyphens:manual\] \[overflow-wrap:break-word\]"/g
      )
    ).toHaveLength(3);
  });

  it("gives invite habit and creator names independent shrinkable wrapping tracks", () => {
    expect(sources.join).toContain(
      'className="flex min-w-0 items-center gap-4 p-4 bg-muted/50 rounded-2xl"'
    );
    expect(sources.join).toContain('className="text-4xl shrink-0"');
    expect(sources.join).toContain('<div className="min-w-0 flex-1">');
    expect(sources.join).toContain(
      'className="min-w-0 break-words font-semibold text-foreground [overflow-wrap:anywhere]"'
    );
    expect(sources.join).toContain('className="min-w-0 break-words [overflow-wrap:anywhere]"');
  });

  it("bounds the live celebration and both absolute badges to viewport safe areas", () => {
    expect(sources.celebration).toContain(
      'className="fixed left-[calc(env(safe-area-inset-left,0px)+1rem)] right-[calc(env(safe-area-inset-right,0px)+1rem)] z-[150] pointer-events-none bottom-[calc(6rem+env(safe-area-inset-bottom,0px))]"'
    );
    expect(sources.celebration).toContain(
      '"relative mx-auto flex w-fit max-w-full min-w-0 items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl motion-safe:transition-all motion-safe:duration-300"'
    );
    expect(sources.celebration).toContain('className="relative shrink-0"');
    expect(sources.celebration).toContain('className="min-w-0 flex-1"');
    expect(sources.celebration).toContain(
      'className="min-w-0 break-words text-base font-bold text-white [overflow-wrap:anywhere]"'
    );
    expect(sources.celebration).toContain(
      'className="absolute -top-10 end-0 flex max-w-full min-w-0 flex-wrap items-center justify-center gap-1.5'
    );
    expect(sources.celebration).toContain(
      'className="absolute -top-14 left-1/2 flex w-max max-w-full min-w-0 flex-wrap items-center justify-center gap-2'
    );
    expect(sources.celebration).toContain("const shouldReduceMotion = useReducedMotion();");
    expect(sources.celebration).toContain(
      "initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.5 }}"
    );
    expect(sources.celebration).toContain('aria-live="polite"');
  });
});
