import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const readFunction = (relativeUrl: string) =>
  readFileSync(fileURLToPath(new URL(relativeUrl, import.meta.url)), "utf8");

const SEND_FUNCTIONS = [
  ["send-push-now", "./index.ts"],
  ["send-push-test", "../send-push-test/index.ts"],
  ["send-scheduled-push", "../send-scheduled-push/index.ts"],
] as const;

const hasPermitScopedTargetAndProviderWork = (source: string) => {
  const permitStart = source.indexOf("const delivery = await withPushDeliveryPermit(");
  const permitEnd = source.indexOf('if (delivery.state === "blocked")', permitStart);
  if (permitStart < 0 || permitEnd <= permitStart) return false;

  const protectedCalls = [
    ...source.matchAll(/\.from\("push_device_tokens"\)/g),
    ...source.matchAll(/await sendFcmNotifications\(/g),
  ];
  return protectedCalls.length > 0 && protectedCalls.every((match) => {
    const index = match.index ?? -1;
    return index > permitStart && index < permitEnd;
  });
};

describe.each(SEND_FUNCTIONS)(
  "%s zero-retention provider contract",
  (_name, relativeUrl) => {
    it("delegates FCM payload construction to the zero-TTL shared builder", () => {
      const source = readFunction(relativeUrl);

      expect(source).toContain("buildRealmBoundAndroidMessage(");
      expect(source).not.toContain("SCHEDULED_DELIVERY_WINDOW_SECONDS");
      expect(source).not.toContain("providerExpirationUnixSeconds");
      expect(source).not.toContain("IMMEDIATE_ONLY_TTL_SECONDS");
      expect(source).not.toContain("TTL:");
    });
  },
);

describe.each([
  ["send-push-now", "./index.ts"],
  ["send-push-test", "../send-push-test/index.ts"],
] as const)("%s provider acceptance response", (_name, relativeUrl) => {
  it("reports FCM acceptance without claiming device delivery", () => {
    const source = readFunction(relativeUrl);

    expect(source).toContain("{ accepted: dispatch.accepted }");
    expect(source).not.toContain("{ sent: dispatch.accepted }");
  });
});

describe.each(SEND_FUNCTIONS)(
  "%s provider admission scope",
  (_name, relativeUrl) => {
    it("keeps target reads and FCM admission inside the owner permit", () => {
      const source = readFunction(relativeUrl);
      expect(hasPermitScopedTargetAndProviderWork(source)).toBe(true);

      const mutant = source.replace(
        "const delivery = await withPushDeliveryPermit(",
        'await sendFcmNotifications([] as never[], "test" as never);\n    const delivery = await withPushDeliveryPermit(',
      );
      expect(hasPermitScopedTargetAndProviderWork(mutant)).toBe(false);
    });
  },
);

describe("shared Android provider retention", () => {
  it("uses FCM TTL zero without describing it as revocation", () => {
    const source = readFunction("../_shared/pushRealmMessage.ts");

    expect(source).toContain('ttl: "0s"');
    expect(source).not.toMatch(/revok|revocat/i);
  });
});

describe.each([
  ["send-push-now", "./index.ts"],
  ["send-push-test", "../send-push-test/index.ts"],
  ["send-scheduled-push", "../send-scheduled-push/index.ts"],
] as const)("%s provider-log privacy", (_name, relativeUrl) => {
  it("logs only fixed event labels, never payload, locale, owner, or token data", () => {
    const source = readFunction(relativeUrl);
    const consoleArguments = [
      ...source.matchAll(/console\.(?:error|warn|log)\(([^)]*)\)/g),
    ].map((match) => match[1].trim());

    expect(consoleArguments.length).toBeGreaterThan(0);
    for (const argument of consoleArguments) {
      expect(argument).toMatch(/^"[^"\r\n]*"$/);
    }
  });
});

describe("scheduled push retry reservation", () => {
  it("avoids a zero-target reservation and releases total provider failures", () => {
    const source = readFunction("../send-scheduled-push/index.ts");
    const targetRead = source.indexOf('.from("push_device_tokens")');
    const reservation = source.indexOf('.from("push_logs")');

    expect(targetRead).toBeGreaterThanOrEqual(0);
    expect(reservation).toBeGreaterThan(targetRead);
    expect(source).toContain("if (targets.length === 0) return noPushTargets()");
    expect(source).toContain("releasePushReservation(");
    expect(source).toContain('.eq("user_id", ownerId)');
    expect(source).toContain('.eq("type", type)');
    expect(source).toContain('.eq("date_key", dateKey)');
    expect(source).toContain('.eq("sent_at", sentAt)');
    expect(source).toContain("shouldReleasePushReservation(dispatch)");
    expect(source).toContain('error: "Push temporarily unavailable"');
    expect(source).not.toContain("delivery proof");
  });
});
