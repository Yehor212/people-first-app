import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PremiumLoader } from "@/components/PremiumLoader";

const source = readFileSync("src/components/PremiumLoader.tsx", "utf8");

describe("PremiumLoader", () => {
  it("uses the red-to-green ZenFlow infinity gradient by default", () => {
    const { container } = render(<PremiumLoader label="Loading" />);
    const stops = container.querySelectorAll("linearGradient stop");

    expect(stops).toHaveLength(5);
    expect(stops[0]).toHaveAttribute(
      "stop-color",
      "var(--premium-loader-stop-1, var(--color-mood-terrible))",
    );
    expect(stops[1]).toHaveAttribute(
      "stop-color",
      "var(--premium-loader-stop-2, var(--color-mood-bad))",
    );
    expect(stops[2]).toHaveAttribute(
      "stop-color",
      "var(--premium-loader-stop-3, var(--color-mood-okay))",
    );
    expect(stops[3]).toHaveAttribute(
      "stop-color",
      "var(--premium-loader-stop-4, var(--color-mood-good))",
    );
    expect(stops[4]).toHaveAttribute(
      "stop-color",
      "var(--premium-loader-stop-5, var(--color-mood-great))",
    );
    expect(container.querySelector('[opacity="var(--premium-loader-base-line-opacity, 0)"]')).toBeTruthy();
  });

  it("does not let Android runtime strain freeze a required loading indicator", () => {
    expect(source).toContain("import { isAndroid } from '@/lib/platform';");
    expect(source).toContain(
      "const animate = shouldAnimate({ respectRuntimePerformance: !isAndroid });",
    );
    expect(source).not.toContain("const animate = shouldAnimate();");
  });
});
