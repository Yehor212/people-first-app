import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260710002000_account_deletion_foreign_keys.sql",
);

describe("account deletion foreign-key actions", () => {
  it("cascades every user's push installations when auth removes the owner", () => {
    const sql = readFileSync(migrationPath, "utf8").replace(/\s+/g, " ");

    expect(sql).toMatch(
      /ALTER TABLE public\.push_device_tokens[\s\S]*FOREIGN KEY \(user_id\)[\s\S]*REFERENCES auth\.users\(id\) ON DELETE CASCADE/i,
    );
  });

  it("preserves global design flags while clearing the deleted admin reference", () => {
    const sql = readFileSync(migrationPath, "utf8").replace(/\s+/g, " ");

    expect(sql).toMatch(
      /ALTER TABLE public\.design_flags[\s\S]*FOREIGN KEY \(updated_by\)[\s\S]*REFERENCES auth\.users\(id\) ON DELETE SET NULL/i,
    );
  });
});
