import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("supabase/functions/send-weekly-digest/index.ts", "utf8");

describe("retired weekly digest", () => {
  it("cannot send fabricated progress or mood claims", () => {
    expect(source).toContain('message: "Weekly digest is retired"');
    expect(source).not.toContain("api.resend.com/emails");
    expect(source).not.toContain("calculateMoodTrend");
    expect(source).not.toContain("weekly_xp");
    expect(source).not.toContain("Your mood is trending up");
    expect(source).not.toContain("Consider some self-care");
  });
});
