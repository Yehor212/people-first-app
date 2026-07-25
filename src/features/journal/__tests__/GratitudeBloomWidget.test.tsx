import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GratitudeBloomWidget } from "../GratitudeBloomWidget";

const animationState = vi.hoisted(() => ({ shouldAnimate: true }));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      close: "Close",
      invalidInput: "Invalid input",
      textTooLong: "Text is too long",
      journalGratitudeTitle: "Plant gratitude",
      journalGratitudePlaceholder: "What are you grateful for?",
      journalGratitudeAction: "Plant it",
      journalGratitudePlanted: "Planted",
      journalGratitudePlantedMsg: "Your gratitude has been planted.",
    },
  }),
}));

vi.mock("@/lib/animationUtils", () => ({
  shouldAnimate: () => animationState.shouldAnimate,
  zenMotion: { gentle: { duration: 0.2 } },
  zenTap: {
    button: { scale: 0.96 },
    icon: { scale: 0.95 },
  },
}));

vi.mock("@/lib/haptics", () => ({
  hapticTap: vi.fn(),
  hapticMedium: vi.fn(),
  hapticSuccess: vi.fn(),
}));

vi.mock("@/lib/a11y", () => ({
  announceSuccess: vi.fn(),
}));

type MotionMockProps<T extends HTMLElement | SVGSVGElement> = React.HTMLAttributes<T> & {
  children?: React.ReactNode;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
  whileTap?: unknown;
  onAnimationComplete?: () => void;
};

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    button: ({ children, initial, animate, exit, transition, whileTap, ...rest }: MotionMockProps<HTMLButtonElement>) => {
      void initial;
      void animate;
      void exit;
      void transition;
      void whileTap;
      return <button {...rest}>{children}</button>;
    },
    div: ({ children, initial, animate, exit, transition, whileTap, onAnimationComplete, ...rest }: MotionMockProps<HTMLDivElement>) => {
      void initial;
      void animate;
      void exit;
      void transition;
      void whileTap;
      void onAnimationComplete;
      return <div {...rest}>{children}</div>;
    },
    svg: ({ children, initial, animate, exit, transition, ...rest }: MotionMockProps<SVGSVGElement>) => {
      void initial;
      void animate;
      void exit;
      void transition;
      return <svg {...rest}>{children}</svg>;
    },
    p: ({ children, initial, animate, exit, transition, ...rest }: MotionMockProps<HTMLParagraphElement>) => {
      void initial;
      void animate;
      void exit;
      void transition;
      return <p {...rest}>{children}</p>;
    },
  },
}));

describe("GratitudeBloomWidget", () => {
  beforeEach(() => {
    animationState.shouldAnimate = true;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("plants gratitude through the bloom animation without closing immediately", () => {
    const onPlant = vi.fn();
    render(<GratitudeBloomWidget onClose={vi.fn()} onPlant={onPlant} />);

    fireEvent.change(screen.getByLabelText("What are you grateful for?"), {
      target: { value: "Morning light on the table" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Plant it" }));

    expect(onPlant).toHaveBeenCalledTimes(1);
    expect(onPlant.mock.calls[0][0]).toMatchObject({
      text: "Morning light on the table",
    });
    expect(screen.getByText("Plant gratitude")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText("Planted")).toBeInTheDocument();
    expect(screen.getByText("Your gratitude has been planted.")).toBeInTheDocument();
  });

  it("uses the reduced-motion path and still plants once", () => {
    animationState.shouldAnimate = false;
    const onPlant = vi.fn();
    render(<GratitudeBloomWidget onClose={vi.fn()} onPlant={onPlant} />);

    fireEvent.change(screen.getByLabelText("What are you grateful for?"), {
      target: { value: "A quiet walk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Plant it" }));

    expect(onPlant).toHaveBeenCalledTimes(1);
    expect(onPlant.mock.calls[0][0]).toMatchObject({ text: "A quiet walk" });
    expect(screen.getByText("Planted")).toBeInTheDocument();
  });

  it("rejects invalid gratitude text before starting the bloom", () => {
    const onPlant = vi.fn();
    render(<GratitudeBloomWidget onClose={vi.fn()} onPlant={onPlant} />);

    fireEvent.change(screen.getByLabelText("What are you grateful for?"), {
      target: { value: "x".repeat(501) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Plant it" }));

    expect(onPlant).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Text is too long");
  });
});
