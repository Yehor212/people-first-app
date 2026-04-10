import { describe, it, expect } from "vitest";
import { calculateDeviceTier, isDesktopClass, supportsMultiPanel, BREAKPOINTS } from "./deviceTier";

describe("calculateDeviceTier", () => {
  it("returns phone for width < 768", () => {
    expect(calculateDeviceTier(375)).toBe("phone");
    expect(calculateDeviceTier(767)).toBe("phone");
  });
  it("returns tablet for 768-1023", () => {
    expect(calculateDeviceTier(768)).toBe("tablet");
    expect(calculateDeviceTier(1023)).toBe("tablet");
  });
  it("returns laptop for 1024-1439", () => {
    expect(calculateDeviceTier(1024)).toBe("laptop");
    expect(calculateDeviceTier(1439)).toBe("laptop");
  });
  it("returns desktop for >= 1440", () => {
    expect(calculateDeviceTier(1440)).toBe("desktop");
    expect(calculateDeviceTier(2560)).toBe("desktop");
  });
  it("returns phone for 0", () => {
    expect(calculateDeviceTier(0)).toBe("phone");
  });
});

describe("isDesktopClass", () => {
  it("true for laptop/desktop, false for phone/tablet", () => {
    expect(isDesktopClass("laptop")).toBe(true);
    expect(isDesktopClass("desktop")).toBe(true);
    expect(isDesktopClass("phone")).toBe(false);
    expect(isDesktopClass("tablet")).toBe(false);
  });
});

describe("supportsMultiPanel", () => {
  it("true for laptop/desktop only", () => {
    expect(supportsMultiPanel("laptop")).toBe(true);
    expect(supportsMultiPanel("desktop")).toBe(true);
    expect(supportsMultiPanel("phone")).toBe(false);
    expect(supportsMultiPanel("tablet")).toBe(false);
  });
});

describe("BREAKPOINTS", () => {
  it("correct values", () => {
    expect(BREAKPOINTS.tablet).toBe(768);
    expect(BREAKPOINTS.laptop).toBe(1024);
    expect(BREAKPOINTS.desktop).toBe(1440);
  });
});
