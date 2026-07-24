import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

async function importOrFailure<T>(specifier: string): Promise<T | { error: Error }> {
  try {
    return (await import(specifier)) as T;
  } catch (error) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }
}

describe("journal AI free mode", () => {
  it("ranks journal entries locally without embeddings and ignores encrypted content bodies", async () => {
    const module = await importOrFailure<
      typeof import("../../supabase/functions/_shared/journal_ai_free")
    >("../../supabase/functions/_shared/journal_ai_free");

    expect("error" in module, "error" in module ? module.error.message : "").toBe(false);

    if ("error" in module) {
      return;
    }

    const results = module.searchJournalEntriesLexically(
      [
        {
          id: "entry-walk",
          title: "Evening walk reflection",
          content: "I walked near the river and felt calmer.",
          mood: "good",
          tags: ["movement", "outside"],
          updated_at: 20,
        },
        {
          id: "entry-encrypted",
          title: "Locked private note",
          content: "encrypted-entry:river walk hidden ciphertext",
          mood: "okay",
          tags: ["private"],
          updated_at: 30,
        },
      ],
      "river walk",
      5
    );

    expect(results[0]).toMatchObject({ entry_id: "entry-walk" });
    expect(results.map((result) => result.entry_id)).not.toContain("entry-encrypted");
    expect(results[0]?.similarity).toBeGreaterThan(0.3);
  });

  it("keeps journal indexing disabled without any external AI provider path", () => {
    const source = readFileSync("supabase/functions/generate-embedding/index.ts", "utf8");

    expect(source).toContain('mode: "journal_search_free_lexical"');
    expect(source).toContain("externalProvider: false");
    expect(source).not.toContain("GEMINI_API_KEY");
    expect(source).not.toContain("generativelanguage.googleapis.com");
    expect(source).not.toContain("journal_embeddings");
  });

  it("always wires journal search to the free lexical implementation", () => {
    const source = readFileSync("supabase/functions/search-journal/index.ts", "utf8");

    expect(source).toContain(
      'import { searchJournalEntriesLexically } from "../_shared/journal_ai_free.ts";'
    );
    expect(source).toContain('mode: "journal_search_free_lexical"');
    expect(source).toContain("externalProvider: false");
    expect(source).not.toContain("GEMINI_API_KEY");
    expect(source).not.toContain("generativelanguage.googleapis.com");
    expect(source).not.toContain("match_journal_entries");
  });
});
