import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BurnThoughtWidget } from "../BurnThoughtWidget";

const animationState = vi.hoisted(() => ({ shouldAnimate: true }));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    isRTL: false,
    t: {
      close: "Close",
      journalBurnTitle: "Burn a thought",
      journalBurnReleased: "Released",
      journalBurnReleasedMessage: "Your thought has been released.",
      journalBurnPlaceholder: "Write what worries you...",
      journalBurnAction: "Burn it",
      journalReleaseFinalTitle: "Released",
      journalReleaseFinalSubtitle: "Text was not saved.",
    },
  }),
}));

vi.mock("@/lib/animationUtils", () => ({
  shouldAnimate: () => animationState.shouldAnimate,
  zenMotion: {
    gentle: { duration: 0.2 },
  },
  zenTap: {
    button: { scale: 0.98 },
    icon: { scale: 0.96 },
  },
}));

vi.mock("@/lib/haptics", () => ({
  hapticWarning: vi.fn(),
  hapticMedium: vi.fn(),
  hapticSuccess: vi.fn(),
  hapticTap: vi.fn(),
}));

vi.mock("@/lib/a11y", () => ({
  announceSuccess: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

type MotionMockProps<T extends HTMLElement> = React.HTMLAttributes<T> & {
  children?: React.ReactNode;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
  whileHover?: unknown;
  whileTap?: unknown;
  onAnimationComplete?: unknown;
};

vi.mock("framer-motion", () => ({
  motion: {
    button: ({
      children,
      initial,
      animate,
      exit,
      transition,
      whileHover,
      whileTap,
      ...rest
    }: MotionMockProps<HTMLButtonElement>) => {
      void initial;
      void animate;
      void exit;
      void transition;
      void whileHover;
      void whileTap;
      return <button {...rest}>{children}</button>;
    },
    div: ({
      children,
      initial,
      animate,
      exit,
      transition,
      whileHover,
      whileTap,
      onAnimationComplete,
      ...rest
    }: MotionMockProps<HTMLDivElement>) => {
      void initial;
      void animate;
      void exit;
      void transition;
      void whileHover;
      void whileTap;
      void onAnimationComplete;
      return <div {...rest}>{children}</div>;
    },
  },
}));

describe("BurnThoughtWidget", () => {
  let rafCallbacks: FrameRequestCallback[];
  let fillRectCalls: unknown[][];
  let fillTextCalls: string[];
  let strokeTextCalls: string[];

  beforeEach(() => {
    animationState.shouldAnimate = true;
    rafCallbacks = [];
    fillRectCalls = [];
    fillTextCalls = [];
    strokeTextCalls = [];

    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 320,
      height: 168,
      top: 0,
      right: 320,
      bottom: 168,
      left: 0,
      toJSON: () => ({}),
    });

    vi.spyOn(performance, "now").mockReturnValue(0);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      const context = {
        scale: vi.fn(),
        clearRect: vi.fn(),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        fillRect: vi.fn((...args: unknown[]) => { fillRectCalls.push(args); }),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        measureText: vi.fn((value: string) => ({ width: value.length * 7 })),
        strokeText: vi.fn((value: string) => { strokeTextCalls.push(value); }),
        fillText: vi.fn((value: string) => { fillTextCalls.push(value); }),
        getImageData: vi.fn((x: number, y: number, width: number, height: number) => {
          void x;
          void y;
          const data = new Uint8ClampedArray(width * height * 4);
          for (let index = 3; index < data.length; index += 64) {
            data[index] = 255;
          }
          return { data };
        }),
        set globalAlpha(value: number) { void value; },
        set fillStyle(value: string | CanvasGradient) { void value; },
        set strokeStyle(value: string | CanvasGradient) { void value; },
        set lineWidth(value: number) { void value; },
        set textAlign(value: CanvasTextAlign) { void value; },
        set textBaseline(value: CanvasTextBaseline) { void value; },
        set direction(value: CanvasDirection) { void value; },
        set shadowBlur(value: number) { void value; },
        set shadowColor(value: string) { void value; },
      };
      return context as unknown as CanvasRenderingContext2D;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("turns the text field into a snap self-destruct scene when releasing a thought", () => {
    const { container } = render(<BurnThoughtWidget onClose={vi.fn()} />);

    const textarea = screen.getByLabelText("Write what worries you...");
    fireEvent.change(textarea, { target: { value: "This thought can leave now." } });
    fireEvent.click(screen.getByRole("button", { name: /Burn it/i }));

    expect(container.querySelector('[data-burn-state="burning"]')).not.toBeNull();
    expect(container.querySelector(".snap-fragment-card")).not.toBeNull();
    expect(container.querySelector(".snap-fragment-text")?.textContent).toContain("This thought can leave now.");
    expect(container.querySelector(".snap-fragment-dust-field")).toBeNull();
    expect(container.querySelectorAll(".snap-fragment-dust-dot")).toHaveLength(0);
    expect(fillTextCalls).toContain("This thought can leave now.");
    expect(strokeTextCalls).toContain("This thought can leave now.");
    expect(fillRectCalls).toHaveLength(0);
    expect(container.querySelector(".snap-pressure-wave")).not.toBeNull();
    expect(container.querySelector(".snap-scatter-field")).toBeNull();
    expect(container.querySelector(".snap-dust-trail")).toBeNull();
    expect(container.querySelector("canvas")?.style.opacity).toBe("1");
    expect(screen.queryByLabelText("Write what worries you...")).toBeNull();

    expect(container.querySelector("[class*='ember']")).toBeNull();
    expect(container.querySelector("[class*='ash']")).toBeNull();
    expect(container.querySelector("[class*='smoke']")).toBeNull();
    expect(container.querySelector("[class*='flame']")).toBeNull();
  });

  it("calls onReleased exactly once without receiving the private text", () => {
    const onReleased = vi.fn();
    render(<BurnThoughtWidget onClose={vi.fn()} onReleased={onReleased} />);

    fireEvent.change(screen.getByLabelText("Write what worries you..."), {
      target: { value: "This should not be saved." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Burn it/i }));

    act(() => {
      rafCallbacks[0]?.(4100);
    });
    act(() => {
      rafCallbacks[1]?.(5200);
    });

    expect(onReleased).toHaveBeenCalledTimes(1);
    expect(onReleased).toHaveBeenCalledWith();
    expect(screen.getByText("Text was not saved.")).toBeInTheDocument();
  });

  it("keeps the ritual card readable during the first half-second pause", () => {
    const { container } = render(<BurnThoughtWidget onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Write what worries you..."), {
      target: { value: "Let this heavy thought go slowly." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Burn it/i }));

    rafCallbacks[0]?.(500);

    const surface = container.querySelector<HTMLElement>(".snap-fragment-surface");
    expect(surface).not.toBeNull();
    expect(Number(surface?.style.opacity)).toBeGreaterThanOrEqual(0.92);
  });

  it("uses only entered symbols as the release particle source and disables text underlines", () => {
    const { container } = render(<BurnThoughtWidget onClose={vi.fn()} />);

    const textarea = screen.getByLabelText("Write what worries you...");
    fireEvent.change(textarea, {
      target: { value: "фывфыв" },
    });

    expect(textarea).toHaveAttribute("spellcheck", "false");
    expect(textarea).toHaveAttribute("autocorrect", "off");
    expect(textarea).toHaveAttribute("autocapitalize", "off");
    expect(textarea).toHaveAttribute("data-gramm", "false");
    expect(container.querySelector(".snap-table-dust-field")).toBeNull();
    expect(container.querySelectorAll(".snap-table-dust-dot")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /Burn it/i }));

    expect(container.querySelector(".snap-table-dust-field")).toBeNull();
    expect(container.querySelector(".snap-fragment-dust-field")).toBeNull();
    expect(container.querySelectorAll(".snap-fragment-dust-dot")).toHaveLength(0);
    expect(fillTextCalls).toContain("фывфыв");
    expect(strokeTextCalls).toContain("фывфыв");
    expect(fillRectCalls).toHaveLength(0);
  });

  it("keeps reduced motion on the release path without particle layers", () => {
    animationState.shouldAnimate = false;
    const onReleased = vi.fn();
    const { container } = render(<BurnThoughtWidget onClose={vi.fn()} onReleased={onReleased} />);

    fireEvent.change(screen.getByLabelText("Write what worries you..."), {
      target: { value: "Release without motion." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Burn it/i }));

    expect(container.querySelector('[data-burn-state="released"]')).not.toBeNull();
    expect(container.querySelector(".snap-fragment-card")).toBeNull();
    expect(container.querySelector(".snap-scatter-field")).toBeNull();
    expect(onReleased).toHaveBeenCalledTimes(1);
    expect(onReleased).toHaveBeenCalledWith();
    expect(screen.getByText("Text was not saved.")).toBeInTheDocument();
  });
});
