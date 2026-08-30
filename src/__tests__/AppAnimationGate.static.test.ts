import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/App.tsx", "utf8");

describe("App animation gate contract", () => {
  it("keeps runtime strain scoped on Android without changing other platforms", () => {
    expect(source).toContain('import { useShouldAnimate } from "@/hooks/useShouldAnimate"');
    expect(source).toContain('import { isAndroid } from "@/lib/platform"');
    expect(source).toContain(
      "const animate = useShouldAnimate({ respectRuntimePerformance: !isAndroid });",
    );
    expect(source).not.toContain(
      "const animate = useShouldAnimate({ respectRuntimePerformance: false });",
    );
    expect(source).not.toContain("const animate = useShouldAnimate();");
    expect(source).not.toContain(
      "const animate = dopamine.animations && !osPrefersReduce && !lowBattery",
    );
  });

  it("still mirrors low-battery state for non-React animation consumers", () => {
    expect(source).toContain("setLowBatteryMirror(lowBattery)");
  });
});
