import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const readFunction = (relativeUrl: string) =>
  readFileSync(fileURLToPath(new URL(relativeUrl, import.meta.url)), "utf8");

const indexOfOrFail = (source: string, needle: string) => {
  const index = source.indexOf(needle);
  expect(index, `Missing source contract: ${needle}`).toBeGreaterThanOrEqual(0);
  return index;
};

const SEND_FUNCTIONS = [
  ["send-push-now", "./index.ts"],
  ["send-push-test", "../send-push-test/index.ts"],
  ["send-scheduled-push", "../send-scheduled-push/index.ts"],
] as const;

describe.each(SEND_FUNCTIONS)(
  "%s durable account-deletion delivery barrier",
  (_name, relativeUrl) => {
    it("pins the audited Supabase SDK and uses the durable permit wrapper", () => {
      const source = readFunction(relativeUrl);

      expect(source).toContain(
        'from "https://esm.sh/@supabase/supabase-js@2.105.4"',
      );
      expect(source).toContain(
        'import { withPushDeliveryPermit } from "../_shared/pushDeletionBarrier.ts";',
      );
      expect(source).not.toContain("checkPushDeliveryEligibility");
      expect(source).toContain("const delivery = await withPushDeliveryPermit(");
      expect(source).toContain(
        "rpc: (functionName, args) => supabase.rpc(functionName, args)",
      );
      expect(source).toContain("randomUUID: () => crypto.randomUUID()");
    });

    it("starts every FCM provider call inside one admitted owner permit", () => {
      const source = readFunction(relativeUrl);
      const permitStart = indexOfOrFail(
        source,
        "const delivery = await withPushDeliveryPermit(",
      );
      const providerEnd = indexOfOrFail(
        source,
        'if (delivery.state === "blocked")',
      );
      const fcmPush = indexOfOrFail(source, "await sendFcmNotifications(");

      expect(fcmPush).toBeGreaterThan(permitStart);
      expect(fcmPush).toBeLessThan(providerEnd);
      expect(source).not.toContain(".sendNotification(");
    });

    it("fails closed before provider work and avoids retrying accepted sends", () => {
      const source = readFunction(relativeUrl);

      expect(source).toContain('if (delivery.state === "blocked")');
      expect(source).toContain('if (delivery.state === "unavailable")');
      expect(source).toContain("delivery.releaseConfirmed");
      expect(source).not.toMatch(/console\.error\([^\n]*,\s*err\s*\)/);
    });
  },
);

describe("request-triggered push responses", () => {
  it.each([
    ["send-push-now", "./index.ts"],
    ["send-push-test", "../send-push-test/index.ts"],
  ] as const)("%s keeps deletion and transient failures indistinguishable from internals", (_name, relativeUrl) => {
    const source = readFunction(relativeUrl);

    expect(source).toContain('error: "Account unavailable"');
    expect(source).toContain('error: "Push temporarily unavailable"');
  });
});

describe("send-scheduled-push permit scope", () => {
  it("admits before dedup and keeps dedup plus FCM in the permit", () => {
    const source = readFunction("../send-scheduled-push/index.ts");
    const permitStart = indexOfOrFail(
      source,
      "const delivery = await withPushDeliveryPermit(",
    );
    const providerEnd = indexOfOrFail(
      source,
      'if (delivery.state === "blocked")',
    );
    const dedup = indexOfOrFail(source, '.from("push_logs")');

    expect(dedup).toBeGreaterThan(permitStart);
    expect(dedup).toBeLessThan(providerEnd);
    expect(source).not.toContain("loadBlockedPushOwnerIds");
    expect(source).not.toContain("const blockedOwners =");
    expect(source).not.toContain("userAgent:");
    expect(source).not.toContain("redactUserRef");
  });
});
