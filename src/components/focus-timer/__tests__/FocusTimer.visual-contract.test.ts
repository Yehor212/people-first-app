import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

const focusTimerSource = readSource("src/components/focus-timer/FocusTimer.tsx");
const backgroundSource = readSource("src/components/focus-timer/CosmicBackground.tsx");
const timerRingSource = readSource("src/components/focus-timer/TimerRing.tsx");
const timerControlsSource = readSource("src/components/focus-timer/TimerControls.tsx");

describe("FocusTimer restrained visual contract", () => {
  it("uses semantic focus surfaces instead of raw palette gradients and glow styles", () => {
    expect(focusTimerSource).toContain("border border-border bg-card");
    expect(focusTimerSource).toContain("border-primary bg-primary/10 text-foreground");
    expect(focusTimerSource).not.toMatch(
      /presetColors|bg-gradient|backdrop-blur|ring-violet|shadow-violet|text-slate|boxShadow|whileHover|whileTap/,
    );
  });

  it("keeps the primary entry marker free of cosmic particles and animated glow", () => {
    expect(backgroundSource).toContain("text-primary");
    expect(backgroundSource).not.toMatch(
      /CosmicStar|cosmicStars|framer-motion|radial-gradient|bg-gradient|backdrop-blur|(?:amber|sky|indigo|violet)-\d/,
    );
  });

  it("renders one semantic progress ring without gradient, glow, or pulsing layers", () => {
    expect(timerRingSource).toContain('stroke="hsl(var(--border))"');
    expect(timerRingSource).toContain('stroke="hsl(var(--primary))"');
    expect(timerRingSource).toContain("motion-safe:transition-[stroke-dashoffset]");
    expect(timerRingSource).not.toMatch(
      /linearGradient|drop-shadow|textShadow|radial-gradient|focus-(?:violet|purple|pink|rose)|repeat:\s*Infinity/,
    );
  });

  it("uses canonical semantic buttons for every timer action", () => {
    expect(timerControlsSource).toContain('variant="default"');
    expect(timerControlsSource).toContain('variant="secondary"');
    expect(timerControlsSource.match(/type="button"/g)).toHaveLength(3);
    expect(timerControlsSource).not.toMatch(
      /framer-motion|useShouldAnimate|zenTap|variant="gradient"|zen-gradient|bg-gradient|shadow-\[|focus-(?:violet|pink)/,
    );
  });
});
