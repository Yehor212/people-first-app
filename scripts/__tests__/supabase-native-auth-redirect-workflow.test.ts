import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflowPath = ".github/workflows/supabase-native-auth-redirect.yml";

describe("Supabase native Auth redirect workflow", () => {
  it("is main-only, least-privilege, exact-confirmation gated, and registered", () => {
    const workflow = readFileSync(workflowPath, "utf8");
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("confirm_native_auth_redirect_apply:");
    expect(workflow).toContain("APPLY_NATIVE_AUTH_REDIRECT");
    expect(workflow).toContain('GITHUB_REF" != "refs/heads/main');
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}");
    expect(workflow).toContain("SUPABASE_PROJECT_REF: ${{ vars.SUPABASE_PROJECT_REF }}");
    expect(workflow).toContain("ZENFLOW_AUTH_REDIRECT_ALLOW_LIST_CONFIRM_PRODUCTION: true");
    expect(workflow).toContain("npm run check:supabase-auth-redirect-allow-list");
    expect(workflow).toContain("npm run apply:supabase-auth-redirect-allow-list");
    expect(workflow).not.toContain("pull_request_target");
    expect(workflow).not.toContain("permissions: write-all");
    expect(workflow).not.toMatch(/echo.*SUPABASE_ACCESS_TOKEN/);
    expect(packageJson.scripts?.["test:release-contracts"]).toContain(
      "scripts/__tests__/supabase-native-auth-redirect-workflow.test.ts",
    );
  });
});
