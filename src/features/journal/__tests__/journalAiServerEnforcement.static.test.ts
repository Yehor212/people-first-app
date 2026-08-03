import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrations = readdirSync("supabase/migrations");
const migrationName = migrations.find((name) => name.endsWith("_journal_ai_consent_enforcement.sql"));
const migration = migrationName
  ? readFileSync(`supabase/migrations/${migrationName}`, "utf8")
  : "";
const generateEmbedding = readFileSync("supabase/functions/generate-embedding/index.ts", "utf8");
const searchJournal = readFileSync("supabase/functions/search-journal/index.ts", "utf8");
const sharedConsentPath = "supabase/functions/_shared/journal_ai_consent.ts";
const sharedConsent = existsSync(sharedConsentPath) ? readFileSync(sharedConsentPath, "utf8") : "";

describe("journal AI server consent enforcement", () => {
  it("defines an owner-only RLS consent record and atomic grant/revoke RPCs", () => {
    expect(migrationName).toBeTruthy();
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.journal_ai_consents");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("TO authenticated");
    expect(migration).toContain("(SELECT auth.uid()) = user_id");
    expect(migration.match(/SECURITY INVOKER/gi)).toHaveLength(3);
    expect(migration).toContain("grant_journal_ai_consent");
    expect(migration).toContain("revoke_journal_ai_consent");
    expect(migration).toContain("generation bigint");
    expect(migration).toContain("grant_journal_ai_consent(p_expected_generation bigint)");
    expect(migration).toMatch(
      /grant_journal_ai_consent[\s\S]*generation = p_expected_generation/,
    );
    expect(migration).toMatch(/revoke_journal_ai_consent[\s\S]*DELETE FROM public\.journal_embeddings/);
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.grant_journal_ai_consent(bigint) FROM PUBLIC");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.revoke_journal_ai_consent() FROM PUBLIC");
  });

  it("denies both edge functions before journal text reaches indexing or search logic", () => {
    expect(sharedConsent).toContain("requireJournalAiConsent");
    for (const source of [generateEmbedding, searchJournal]) {
      expect(source).toContain('from "../_shared/journal_ai_consent.ts"');
      const consentCheck = source.indexOf("requireJournalAiConsent");
      const freeModeResponse = source.indexOf('mode: "journal_search_free_lexical"');
      expect(consentCheck).toBeGreaterThan(0);
      expect(freeModeResponse).toBeGreaterThan(consentCheck);
    }
    expect(searchJournal.indexOf("requireJournalAiConsent")).toBeLessThan(
      searchJournal.indexOf('.from("journal_entries")'),
    );
  });

  it("keeps the consent migration able to delete historical embeddings", () => {
    expect(migration).toContain("upsert_journal_embeddings_if_consented");
    expect(migration).toMatch(/revoke_journal_ai_consent[\s\S]*DELETE FROM public\.journal_embeddings/);
  });

  it("contains no reachable external AI provider path", () => {
    for (const source of [generateEmbedding, searchJournal]) {
      expect(source).not.toContain("GEMINI_API_KEY");
      expect(source).not.toContain("generativelanguage.googleapis.com");
      expect(source).toContain("externalProvider: false");
    }
  });
});
