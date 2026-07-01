import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("ai-coach RAG release contract", () => {
  const aiCoach = read("supabase/functions/ai-coach/index.ts");
  const config = read("supabase/config.toml");

  it("keeps the edge function JWT-protected and validates the signed-in user", () => {
    expect(config).toContain("[functions.ai-coach]");
    expect(config).toContain("verify_jwt = true");
    expect(aiCoach).toContain("SUPABASE_ANON_KEY");
    expect(aiCoach).toContain("global: { headers: { Authorization: `Bearer ${token}` } }");
    expect(aiCoach).toContain("supabase.auth.getUser()");
  });

  it("uses a server-only Supabase client for project-document RAG", () => {
    expect(aiCoach).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(aiCoach).toContain("createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    expect(aiCoach).toContain("ragSupabase.rpc(\"match_rag_chunks\"");
    expect(aiCoach).not.toMatch(/VITE_SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("keeps RAG supplemental so an empty or temporarily blocked RAG index does not break coaching", () => {
    expect(aiCoach).toContain("buildAICoachRagResponse");
    expect(aiCoach).toContain("fallbackContents: contents");
    expect(aiCoach).toContain("buildCoachLiteResponse");
    expect(aiCoach).toContain("sources: ragResponse.sources");
  });
});
