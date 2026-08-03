import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { deletionRequestMatchesAuthenticatedOwner } from "./requestContract";

describe("delete-account owner request contract", () => {
  it("accepts only the account authenticated by the request JWT", () => {
    expect(deletionRequestMatchesAuthenticatedOwner("account-a", "account-a")).toBe(true);
    expect(deletionRequestMatchesAuthenticatedOwner("account-a", "account-b")).toBe(false);
    expect(deletionRequestMatchesAuthenticatedOwner(undefined, "account-a")).toBe(false);
    expect(deletionRequestMatchesAuthenticatedOwner("", "account-a")).toBe(false);
  });

  it("pins the Edge SDK version used by the experimental flat Storage API", () => {
    const initialSource = readFileSync(
      resolve(process.cwd(), "supabase/functions/delete-account/index.ts"),
      "utf8",
    );
    const recoverySource = readFileSync(
      resolve(process.cwd(), "supabase/functions/resume-account-deletion/index.ts"),
      "utf8",
    );
    const pinnedImport =
      'https://esm.sh/@supabase/supabase-js@2.105.4';

    expect(initialSource).toContain(pinnedImport);
    expect(recoverySource).toContain(pinnedImport);
  });
});
