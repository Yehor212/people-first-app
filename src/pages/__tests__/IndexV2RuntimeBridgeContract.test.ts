import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexSource = () => readFileSync("src/pages/Index.tsx", "utf8");

describe("Index V2 runtime bridge contract", () => {
  it("registers the gamification bridge inside the V2 shell", () => {
    const source = indexSource();

    expect(source).toContain("useHydrateGamification");
    expect(source).toContain("plantSeed,");
    expect(source).toContain("waterPlants,");
    expect(source).toContain("useHydrateGamification({ awardXp, earnTreats, plantSeed, waterPlants });");
  });
  it("mounts hook-only runtime effects inside the V2 shell", () => {
    const source = indexSource();

    expect(source).toContain('import { supabase } from "@/lib/supabaseClient";');
    expect(source).toContain('import { useSessionTimeout } from "@/hooks/useSessionTimeout";');
    expect(source).toContain('import { useReminderMigration } from "@/hooks/useReminderMigration";');
    expect(source).toContain('import { useEmotionSync } from "@/hooks/useEmotionSync";');
    expect(source).toContain("useSessionTimeout(!!supabase);");
    expect(source).toContain("useReminderMigration();");
    expect(source).toContain("useEmotionSync();");
  });
});
