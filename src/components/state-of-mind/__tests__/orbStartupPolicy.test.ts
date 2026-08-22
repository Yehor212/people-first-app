import { describe, expect, it } from "vitest";

import { shouldSkipCanonicalOrbPrewarm } from "../orbStartupPolicy";

describe("shouldSkipCanonicalOrbPrewarm", () => {
  it("does not start a second GPU worker when Android boots at the bare root into Orb", () => {
    expect(
      shouldSkipCanonicalOrbPrewarm({
        isNativeRuntime: true,
        pathname: "/",
        storedPage: "orb",
      })
    ).toBe(true);
  });

  it("treats an empty Android navigation preference as the default Orb route", () => {
    expect(
      shouldSkipCanonicalOrbPrewarm({
        isNativeRuntime: true,
        pathname: "/",
        storedPage: "",
      })
    ).toBe(true);
  });

  it("keeps the idle prewarm for Android when another primary page opens first", () => {
    expect(
      shouldSkipCanonicalOrbPrewarm({
        isNativeRuntime: true,
        pathname: "/",
        storedPage: "habits",
      })
    ).toBe(false);
  });

  it("skips prewarm for a direct Orb path on every runtime", () => {
    expect(
      shouldSkipCanonicalOrbPrewarm({
        isNativeRuntime: false,
        pathname: "/people-first-app/orb/",
        storedPage: "habits",
      })
    ).toBe(true);
  });

  it("does not change the existing web bare-root prewarm policy", () => {
    expect(
      shouldSkipCanonicalOrbPrewarm({
        isNativeRuntime: false,
        pathname: "/",
        storedPage: "orb",
      })
    ).toBe(false);
  });
});
