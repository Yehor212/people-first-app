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

  it("mounts the durable critical-sync retry surface in the V2 shell", () => {
    const source = indexSource();

    expect(source).toContain('import { StorageErrorBanner } from "@/components/StorageErrorBanner";');
    expect(source).toContain("<StorageErrorBanner />");
  });

  it("keeps the retired analytics runtime disabled until a real provider and consent flow exist", () => {
    const source = indexSource();

    expect(source).not.toContain('import { analytics } from "@/lib/analytics";');
    expect(source).not.toContain("analytics.init(");
  });

  it("routes Settings reminder changes through the durable-first handler", () => {
    const source = indexSource();

    expect(source).toContain("handleRemindersChange");
    expect(source).toContain("onRemindersChange: handleRemindersChange");
    expect(source).not.toContain("onRemindersChange: setReminders");
  });
});
