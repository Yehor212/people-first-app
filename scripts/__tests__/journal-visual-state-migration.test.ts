import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260713063712_add_journal_visual_state.sql",
  "utf8"
);

describe("journal visual-state migration", () => {
  it("scopes every idempotent constraint lookup to journal_entries", () => {
    const constraintLookups = migration.match(/SELECT 1 FROM pg_constraint[^;]+/g) ?? [];

    expect(constraintLookups.length).toBeGreaterThanOrEqual(10);
    for (const lookup of constraintLookups) {
      expect(lookup).toContain("conrelid = 'public.journal_entries'::regclass");
    }
  });

  it("allows only supported journal background patterns", () => {
    expect(migration).toContain("journal_entries_bg_pattern_valid");
    for (const pattern of [
      "none",
      "sakura",
      "honey",
      "washi-morning",
      "cloud",
      "matcha",
      "peach",
      "aurora",
      "moonlight",
      "watercolor",
      "stardust",
      "garden",
      "cotton-candy",
      "sunset-beach",
      "snowfall",
    ]) {
      expect(migration).toContain(`'${pattern}'`);
    }
  });

  it("bounds photo layout count, coordinates, and width at the database boundary", () => {
    expect(migration).toContain(
      "jsonb_array_length(jsonb_path_query_array(photo_layout, '$.keyvalue()')) <= 5"
    );
    expect(migration).toContain("!exists(@.x) || !exists(@.y) || !exists(@.width)");
    expect(migration).toContain("@.x < 0 || @.x > 100");
    expect(migration).toContain("@.y < 0 || @.y > 100");
    expect(migration).toContain("@.width < 80 || @.width > 500");
  });

  it("reloads the PostgREST schema after the additive change", () => {
    expect(migration).toContain("NOTIFY pgrst, 'reload schema';");
  });
});
