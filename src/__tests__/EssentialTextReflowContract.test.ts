import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TARGET_FILES = [
  "src/components/schedule/TaskFocusPanel.tsx",
  "src/components/friends-panel/FriendDetailView.tsx",
  "src/components/friends-panel/FriendProfileCard.tsx",
  "src/components/friends-panel/FriendsPanel.tsx",
  "src/components/Header.tsx",
  "src/components/UpdatePrompt.tsx",
  "src/components/SmartRemindersCard.tsx",
] as const;

function source(path: (typeof TARGET_FILES)[number]) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("essential navigation, update, reminder, profile, and activity text reflow", () => {
  it.each(TARGET_FILES)("does not hide essential copy in %s", (path) => {
    expect(source(path)).not.toMatch(/\b(?:truncate|line-clamp-\d+)\b/);
  });

  it("keeps the task timeline as one bounded, focusable horizontal scroller", () => {
    const timeline = source("src/components/schedule/TaskFocusPanel.tsx");

    expect(timeline).toContain("max-w-full overflow-x-auto overscroll-x-contain");
    expect(timeline).toContain('role="region"');
    expect(timeline).toContain("tabIndex={0}");
    expect(timeline).toContain("w-max min-w-full");
    expect(timeline).toContain("min-h-11");
    expect(timeline).toContain("flexBasis: 0");
    expect(timeline).toContain("calc(7rem * var(--font-scale, 1))");
    expect(timeline).toContain("[overflow-wrap:anywhere]");
  });

  it("gives navigation labels adaptive columns without fragmenting localized copy", () => {
    const header = source("src/components/Header.tsx");

    expect(header).toContain(
      "grid-cols-[repeat(auto-fit,minmax(min(100%,calc(8rem*var(--font-scale,1))),1fr))]"
    );
    expect(header).toContain("whitespace-normal break-words");
    expect(header.match(/\[overflow-wrap:anywhere\]/g)).toHaveLength(1);
  });

  it("lets friend identity, activity, stats, and confirmation controls reflow", () => {
    const detail = source("src/components/friends-panel/FriendDetailView.tsx");
    const profile = source("src/components/friends-panel/FriendProfileCard.tsx");
    const panel = source("src/components/friends-panel/FriendsPanel.tsx");

    expect(detail).toContain(
      "grid-cols-[repeat(auto-fit,minmax(min(100%,calc(7rem*var(--font-scale,1))),1fr))]"
    );
    expect(detail).toContain(
      "grid-cols-[repeat(auto-fit,minmax(min(100%,calc(9rem*var(--font-scale,1))),1fr))]"
    );
    expect(detail).toContain("[overflow-wrap:anywhere]");
    expect(profile).toContain("h-11 w-11 shrink-0");
    expect(profile).toContain("[overflow-wrap:anywhere]");
    expect(panel).toContain("flex flex-col gap-3 min-[420px]:flex-row");
    expect(panel.match(/\[overflow-wrap:anywhere\]/g)).toHaveLength(2);
  });

  it("bounds the friend code locally without forcing profile copy onto one line", () => {
    const profile = source("src/components/friends-panel/FriendProfileCard.tsx");

    expect(profile).not.toContain("whitespace-nowrap");
    expect(profile).toContain("overflow-x-auto overscroll-x-contain");
    expect(profile).toContain("select-all");
    expect(profile).toContain("tabIndex={0}");
  });

  it("keeps complete update details and its action reachable in a bounded banner", () => {
    const update = source("src/components/UpdatePrompt.tsx");

    expect(update).toContain(
      "max-h-[calc(100dvh_-_env(safe-area-inset-top)_-_2rem)] overflow-y-auto overscroll-contain"
    );
    expect(update).toContain("min-h-11");
    expect(update).toContain("whitespace-normal break-words");
  });

  it("lets reminder metadata stack while limiting arbitrary breaks to habit names", () => {
    const reminders = source("src/components/SmartRemindersCard.tsx");

    expect(reminders).toContain("flex flex-col items-stretch gap-2 min-[420px]:flex-row");
    expect(reminders).toContain("flex flex-wrap");
    expect(reminders).toContain("min-h-11");
    expect(reminders.match(/\[overflow-wrap:anywhere\]/g)).toHaveLength(1);
  });
});
