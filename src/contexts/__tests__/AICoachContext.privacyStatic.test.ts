import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const coachSource = readFileSync("src/contexts/AICoachContext.tsx", "utf8");
const storageKeysSource = readFileSync("src/lib/storageKeys.ts", "utf8");

describe("AI Coach journal privacy contract", () => {
  it("does not add diary snippets to coach context without explicit journal-coach consent", () => {
    expect(storageKeysSource).toContain("JOURNAL_AI_COACH_CONTEXT_CONSENT");
    expect(coachSource).toContain(
      'storageGetRaw(SK.JOURNAL_AI_COACH_CONTEXT_CONSENT) === "true"',
    );
    expect(coachSource).toContain("if (canUseJournalEntriesForCoach) {");

    const consentBlock =
      /if \(canUseJournalEntriesForCoach\) \{[\s\S]*?\n {4}\}/.exec(coachSource)?.[0] ?? "";
    expect(consentBlock).toContain('import("@/features/journal/journalStorage")');
    expect(consentBlock).toContain("snippet: e.content.slice(0, 100)");
  });
});
