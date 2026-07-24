import { describe, expect, it } from "vitest";

import { createAccountDeletionCapability } from "../accountDeletionCapability";

describe("createAccountDeletionCapability", () => {
  it("creates a UUID v4 and canonical 32-byte base64url secret", () => {
    let next = 0;
    const cryptoSource = {
      getRandomValues<T extends ArrayBufferView | null>(array: T): T {
        if (!array || !(array instanceof Uint8Array)) return array;
        for (let index = 0; index < array.length; index += 1) {
          array[index] = next % 256;
          next += 1;
        }
        return array;
      },
    };

    const result = createAccountDeletionCapability(cryptoSource);

    expect(result.operationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(result.recoverySecret).toMatch(
      /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/,
    );
    expect(result.recoverySecret).not.toContain("=");
  });

  it("fails closed when a cryptographically secure source is unavailable", () => {
    expect(() => createAccountDeletionCapability(null)).toThrow(
      "Secure account deletion recovery is unavailable",
    );
  });
});
