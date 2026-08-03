/**
 * Bloom × choreography composition — regression test for the wiring bug
 * found by the 10-agent review (Role 9): passing
 * `transition={staggerDelay(stage)}` replaced the Bloom verb's timing
 * entirely, so the flagship orb flow ran framer-motion library defaults
 * (underdamped y spring) instead of the designed 320ms bloomOut glide.
 *
 * The component must MERGE caller transition keys over the verb timing,
 * not replace it.
 */

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { easings } from "../easings";

vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: vi.fn(),
}));

const captured: Array<Record<string, unknown>> = [];

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    motion: {
      ...actual.motion,
      div: (props: Record<string, unknown> & { children?: React.ReactNode }) => {
        captured.push(props);
        const { children, ...rest } = props;
        return <div {...rest}>{children}</div>;
      },
    },
  };
});

import { Bloom } from "../components/Bloom";
import { Fold } from "../components/Fold";
import { Breathe } from "../components/Breathe";

describe("Bloom transition composition", () => {
  beforeEach(() => {
    captured.length = 0;
    vi.mocked(useShouldAnimate).mockReturnValue(true);
  });

  it("keeps the bloomOut timing when a stagger delay is passed", () => {
    render(<Bloom transition={{ delay: 0.14 }} />);
    const transition = captured[0]?.transition as Record<string, unknown>;
    expect(transition).toMatchObject({
      duration: 0.32,
      ease: easings.bloomOut,
      delay: 0.14,
    });
  });

  it("lets the caller override timing keys explicitly", () => {
    render(<Bloom transition={{ delay: 0.36, duration: 0.4 }} />);
    const transition = captured[0]?.transition as Record<string, unknown>;
    expect(transition).toMatchObject({
      duration: 0.4,
      ease: easings.bloomOut,
      delay: 0.36,
    });
  });

  it("uses the pure verb timing with no caller transition", () => {
    render(<Bloom />);
    const transition = captured[0]?.transition as Record<string, unknown>;
    expect(transition).toMatchObject({ duration: 0.32, ease: easings.bloomOut });
  });
});

describe("Fold transition composition", () => {
  beforeEach(() => {
    captured.length = 0;
    vi.mocked(useShouldAnimate).mockReturnValue(true);
  });

  it("keeps the foldIn timing when a delay is passed", () => {
    render(<Fold transition={{ delay: 0.1 }} />);
    const transition = captured[0]?.transition as Record<string, unknown>;
    expect(transition).toMatchObject({
      duration: 0.24,
      ease: easings.foldIn,
      delay: 0.1,
    });
  });
});

describe("Breathe transition composition", () => {
  beforeEach(() => {
    captured.length = 0;
    vi.mocked(useShouldAnimate).mockReturnValue(true);
  });

  it("keeps the 4s breathing loop when a delay is passed", () => {
    render(<Breathe transition={{ delay: 0.2 }} />);
    const transition = captured[0]?.transition as Record<string, unknown>;
    expect(transition).toMatchObject({
      duration: 4,
      ease: easings.breathe,
      repeat: Infinity,
      delay: 0.2,
    });
  });
});
