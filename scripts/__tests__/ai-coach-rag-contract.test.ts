import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("ai-coach no-paid-provider release contract", () => {
  const aiCoach = read("supabase/functions/ai-coach/index.ts");
  const config = read("supabase/config.toml");

  it("keeps the edge function JWT-protected and validates the signed-in user", () => {
    expect(config).toContain("[functions.ai-coach]");
    expect(config).toContain("verify_jwt = true");
    expect(aiCoach).toContain("SUPABASE_ANON_KEY");
    expect(aiCoach).toContain('const authHeader = req.headers.get("Authorization")');
    expect(aiCoach).toContain('authHeader?.startsWith("Bearer ")');
    expect(aiCoach).toContain("global: { headers: { Authorization: authHeader } }");
    expect(aiCoach).toContain("supabase.auth.getUser()");
  });

  it("does not send coaching context to a paid or external model provider", () => {
    expect(aiCoach).toContain("buildCoachLiteResponse");
    expect(aiCoach).toContain("externalProvider: false");
    expect(aiCoach).not.toContain("GEMINI_API_KEY");
    expect(aiCoach).not.toContain("generateContent");
    expect(aiCoach).not.toContain("match_rag_chunks");
    expect(aiCoach).not.toMatch(/VITE_SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("returns an explicit Coach Lite response without claiming paid-model output", () => {
    expect(aiCoach).toContain("message: coachLite.message");
    expect(aiCoach).toContain("mode: coachLite.mode");
    expect(aiCoach).toContain("requiresPaidApi: coachLite.requiresPaidApi");
    expect(aiCoach).toContain("sources: coachLite.sources");
    expect(aiCoach).toContain("externalProvider: false");
  });
});
