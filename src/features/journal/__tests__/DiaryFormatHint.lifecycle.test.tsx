import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiaryFormatHint } from "../DiaryFormatHint";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      diaryFormatHint: "Select text to format",
      diaryFormatHintLabel: "Text tools",
    },
  }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  },
}));

describe("DiaryFormatHint lifecycle", () => {
  afterEach(() => vi.useRealTimers());

  it("hides itself after the timeout without requiring a parent rerender", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<DiaryFormatHint onDismiss={onDismiss} />);

    expect(screen.getByRole("button", { name: "Select text to format" })).toBeInTheDocument();
    void act(() => vi.advanceTimersByTime(5_000));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Select text to format" })).toBeNull();
  });

  it("dismisses once when the user activates it before the timeout", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<DiaryFormatHint onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: "Select text to format" }));
    void act(() => vi.advanceTimersByTime(5_000));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Select text to format" })).toBeNull();
  });

  it("does not expire while a keyboard user is focused on the hint", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<DiaryFormatHint onDismiss={onDismiss} />);

    const hint = screen.getByRole("button", { name: "Select text to format" });
    fireEvent.focus(hint);
    void act(() => vi.advanceTimersByTime(10_000));

    expect(hint).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.blur(hint);
    void act(() => vi.advanceTimersByTime(5_000));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Select text to format" })).toBeNull();
  });
});
