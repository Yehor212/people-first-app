// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseT184QaLaunchOptions } from "../src/test/t184/qaLaunchOptions";

describe("T184 QA launch options", () => {
  it("accepts only supported locale, route, and auth controls", () => {
    expect(parseT184QaLaunchOptions("?qaLang=ar&qaRoute=diary&qaAuth=1")).toEqual({
      language: "ar",
      route: "diary",
      auth: true,
    });
    expect(parseT184QaLaunchOptions("?qaLang=xx&qaRoute=admin")).toEqual({
      language: "en",
      route: "orb",
      auth: false,
    });
  });
});
