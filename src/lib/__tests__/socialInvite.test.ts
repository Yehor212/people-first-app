import { describe, expect, it, vi } from "vitest";

import {
  buildSocialInviteUrl,
  parseSocialInviteUrl,
} from "@/lib/socialInvite";

const CHALLENGE_CODE = "ZEN-TEST24";

describe("social invite URL trust boundary", () => {
  it("builds a canonical HTTPS challenge locator without embedding domain facts", () => {
    const url = buildSocialInviteUrl("challenge", CHALLENGE_CODE);

    expect(url).toBe(
      "https://yehor212.github.io/people-first-app/?invite=challenge.v1&code=ZEN-TEST24",
    );
    expect(url).not.toMatch(/habit|duration|creator|user|token|data=/i);
  });

  it("decodes a canonical locator without storage, network, or navigation writes", () => {
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const historySpy = vi.spyOn(window.history, "replaceState");

    const parsed = parseSocialInviteUrl(
      "https://yehor212.github.io/people-first-app/?invite=challenge.v1&code=ZEN-TEST24",
      "challenge",
    );

    expect(parsed).toEqual({
      ok: true,
      envelope: { code: CHALLENGE_CODE, type: "challenge", version: 1 },
    });
    expect(storageSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(historySpy).not.toHaveBeenCalled();
  });

  it.each([
    [
      "cross type",
      "https://yehor212.github.io/people-first-app/?invite=friend.v1&code=FRI-ABCDEFGH",
      "type_mismatch",
    ],
    [
      "unknown version",
      "https://yehor212.github.io/people-first-app/?invite=challenge.v2&code=ZEN-TEST24",
      "unsupported_invite",
    ],
    [
      "hostile origin",
      "https://evil.example/people-first-app/?invite=challenge.v1&code=ZEN-TEST24",
      "untrusted_origin",
    ],
    [
      "wrong path",
      "https://yehor212.github.io/people-first-app/privacy.html?invite=challenge.v1&code=ZEN-TEST24",
      "untrusted_path",
    ],
    [
      "extra field",
      "https://yehor212.github.io/people-first-app/?invite=challenge.v1&code=ZEN-TEST24&redirect=https%3A%2F%2Fevil.example",
      "unexpected_parameter",
    ],
    [
      "duplicate field",
      "https://yehor212.github.io/people-first-app/?invite=challenge.v1&code=ZEN-TEST24&code=ZEN-OTHER2",
      "duplicate_parameter",
    ],
    [
      "fragment",
      "https://yehor212.github.io/people-first-app/?invite=challenge.v1&code=ZEN-TEST24#token=secret",
      "unexpected_fragment",
    ],
    [
      "invalid code",
      "https://yehor212.github.io/people-first-app/?invite=challenge.v1&code=%3Cscript%3E",
      "invalid_code",
    ],
  ])("rejects %s without returning an envelope", (_label, value, reason) => {
    expect(parseSocialInviteUrl(value, "challenge")).toEqual({ ok: false, reason });
  });

  it("rejects oversized input before URL parsing", () => {
    const oversized =
      "https://yehor212.github.io/people-first-app/?invite=challenge.v1&code=" +
      "A".repeat(600);

    expect(parseSocialInviteUrl(oversized, "challenge")).toEqual({
      ok: false,
      reason: "input_too_large",
    });
  });
});
