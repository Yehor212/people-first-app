import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/components/leaderboard/LeaderboardEntryRow.tsx", "utf8");

describe("LeaderboardEntryRow reflow contract", () => {
  it("gives current-user and best-streak metadata full-width narrow rows", () => {
    expect(source).toContain(
      "col-span-2 col-start-1 row-start-2 min-w-0 max-w-full justify-self-start whitespace-normal break-words",
    );
    expect(source).toContain(
      'entry.isCurrentUser ? "row-start-3" : "row-start-2"',
    );
    expect(source).not.toContain(
      'className="shrink-0 rounded bg-violet-500/20',
    );
  });

  it("keeps score values and localized units inside a wrapping bidi-safe row", () => {
    expect(source).toContain(
      "col-span-2 col-start-1 flex max-w-full min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0",
    );
    expect(source.match(/\[unicode-bidi:isolate\]/g)).toHaveLength(3);
    expect(source).toContain("<bdi>{entry.longestStreak}</bdi>");
    expect(source).not.toContain('className="ms-1 whitespace-normal break-words');
  });
});
