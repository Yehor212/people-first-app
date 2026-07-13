import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/App.tsx", "utf8");

describe("App animation gate contract", () => {
  it("uses the shared effective motion hook so runtime performance is respected globally", () => {
    expect(source).toContain('import { useShouldAnimate } from "@/hooks/useShouldAnimate"');
    expect(source).toContain("const animate = useShouldAnimate();");
    expect(source).not.toContain(
      "const animate = dopamine.animations && !osPrefersReduce && !lowBattery",
    );
  });

  it("still mirrors low-battery state for non-React animation consumers", () => {
    expect(source).toContain("setLowBatteryMirror(lowBattery)");
  });
});
