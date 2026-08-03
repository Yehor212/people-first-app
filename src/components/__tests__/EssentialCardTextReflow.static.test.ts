import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(`src/components/${path}.tsx`, "utf8");

const sources = {
  weeklyReport: read("WeeklyReport"),
  goalNode: read("canvas/GoalNode"),
  participants: read("challenges/ParticipantsLeaderboard"),
  badge: read("challenges-panel/BadgeCard"),
  leaderboard: read("leaderboard/LeaderboardEntryRow"),
  quest: read("quests-panel/QuestCard"),
  achievement: read("stories/slides/AchievementSlide"),
  insights: read("weekly-insights-card/WeeklyInsightsParts"),
  challengesPanel: read("challenges-panel/ChallengesPanel"),
  virtualGrid: read("ui/virtual-list"),
  challengeDetails: read("challenges/ChallengeDetailsView"),
  challengeList: read("challenges/ChallengesListView"),
};

describe("essential cards full-text reflow contract", () => {
  it("does not clip essential localized or user-authored text", () => {
    for (const source of Object.values(sources)) {
      expect(source).not.toMatch(/\b(?:truncate|line-clamp(?:-[0-9]+)?)\b/);
    }
  });

  it("uses emergency wrapping only for unbounded user-authored identifiers", () => {
    for (const source of [sources.goalNode, sources.participants, sources.leaderboard]) {
      expect(source).toContain("[overflow-wrap:anywhere]");
    }

    for (const source of [
      sources.weeklyReport,
      sources.badge,
      sources.quest,
      sources.achievement,
      sources.insights,
    ]) {
      expect(source).toContain("break-words");
      expect(source).not.toContain("[overflow-wrap:anywhere]");
    }
  });

  it("lets bounded report, quest, badge, and insight cards grow vertically", () => {
    expect(sources.weeklyReport).toContain(
      "grid grid-cols-1 gap-3 px-6 mb-6 min-[420px]:grid-cols-2",
    );
    expect(sources.weeklyReport).toContain("min-h-11 min-w-11");
    expect(sources.badge).toContain("relative h-auto min-w-0");
    expect(sources.badge).not.toContain("h-full");
    expect(sources.quest).toContain("h-auto min-w-0");
    expect(sources.insights).toContain("h-auto min-h-11");
  });

  it("gives user names separate responsive tracks from ranks and scores", () => {
    expect(sources.participants).toContain(
      "grid grid-cols-[2rem_minmax(0,1fr)] items-start",
    );
    expect(sources.participants).toContain(
      "min-[420px]:grid-cols-[2rem_minmax(0,1fr)_auto_auto]",
    );
    expect(sources.leaderboard).toContain(
      "grid grid-cols-[2.25rem_minmax(0,1fr)] items-start",
    );
    expect(sources.leaderboard).toContain(
      "min-[420px]:grid-cols-[2.25rem_minmax(0,1fr)_auto]",
    );
  });

  it("lets canvas goals expand while keeping a 48 pixel minimum action", () => {
    expect(sources.goalNode).toContain("minHeight: PILL_H");
    expect(sources.goalNode).not.toContain("height: PILL_H");
    expect(sources.goalNode).toContain("h-auto min-h-12");
    expect(sources.goalNode).toContain('height: "calc(100% + 16px)"');
  });

  it("makes the bounded achievement slide scrollable with responsive pedestal rows", () => {
    expect(sources.achievement).toContain("overflow-y-auto overscroll-y-contain");
    expect(sources.achievement).toContain(
      "grid w-full grid-cols-1 gap-x-6 gap-y-8 min-[360px]:grid-cols-2 min-[720px]:grid-cols-4",
    );
  });

  it("measures virtual badge rows instead of clipping them to an estimated height", () => {
    expect(sources.challengesPanel).toContain("estimatedItemHeight={240}");
    expect(sources.challengesPanel).not.toContain("itemHeight={180}");
    expect(sources.challengesPanel).toContain(
      "const virtualizeBadges = shouldVirtualize(badges.length);",
    );
    expect(sources.challengesPanel).toContain(
      'selectedTab === "badges" && virtualizeBadges',
    );
    expect(sources.challengesPanel).toContain('? "overflow-hidden"');
    expect(sources.challengesPanel).toContain(': "overflow-y-auto"');
    expect(sources.virtualGrid).toContain("data-index={virtualRow.index}");
    expect(sources.virtualGrid).toContain("ref={virtualizer.measureElement}");
    expect(sources.virtualGrid).toContain("paddingBottom: gap");
    expect(sources.virtualGrid).not.toContain(
      "height: `${virtualRow.size - gap}px`",
    );
    expect(sources.virtualGrid).not.toContain('className="grid h-full"');
    expect(sources.badge).not.toContain("overflow-y-auto");
  });

  it("keeps badge cards and the panel heading single-column until 520 pixels", () => {
    expect(sources.challengesPanel).toContain(
      'const hasWideBadgeGrid = useMediaQuery("(min-width: 520px)");',
    );
    expect(sources.challengesPanel).toContain(
      "columns={hasWideBadgeGrid ? 2 : 1}",
    );
    expect(sources.challengesPanel).not.toContain("columns={2}");
    expect(sources.challengesPanel).toContain(
      'className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2"',
    );
    expect(sources.challengesPanel).toContain(
      'className="zen-gradient grid min-w-0 grid-cols-1 gap-3 p-6 min-[520px]:grid-cols-[minmax(0,1fr)_auto] min-[520px]:items-start"',
    );
    expect(sources.challengesPanel).toContain(
      'className="min-w-0 break-words text-2xl font-bold text-primary-foreground mb-1"',
    );
    expect(sources.challengesPanel).toContain("justify-self-end");
  });

  it("keeps the three assigned challenge text actions at least 48 pixels and multiline", () => {
    expect(
      sources.challengeDetails.match(
        /h-auto min-h-12 min-w-0 whitespace-normal break-words py-3/g,
      ),
    ).toHaveLength(2);
    expect(sources.challengeDetails).toContain(
      "grid grid-cols-1 gap-3 min-[420px]:grid-cols-2",
    );
    expect(sources.challengeList).toContain(
      "w-full h-auto min-h-12 whitespace-normal break-words py-3",
    );
  });
});
