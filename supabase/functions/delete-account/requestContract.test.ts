import { describe, expect, it } from "vitest";
import { deletionRequestMatchesAuthenticatedOwner } from "./requestContract";

describe("delete-account owner request contract", () => {
  it("accepts only the account authenticated by the request JWT", () => {
    expect(deletionRequestMatchesAuthenticatedOwner("account-a", "account-a")).toBe(true);
    expect(deletionRequestMatchesAuthenticatedOwner("account-a", "account-b")).toBe(false);
    expect(deletionRequestMatchesAuthenticatedOwner(undefined, "account-a")).toBe(false);
    expect(deletionRequestMatchesAuthenticatedOwner("", "account-a")).toBe(false);
  });
});
