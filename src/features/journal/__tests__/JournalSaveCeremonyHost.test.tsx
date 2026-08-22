import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JournalSaveCommitReceipt } from "../save-ceremony/journalSaveCeremonyContract";
import { JournalSaveCeremonyHost } from "../save-ceremony/JournalSaveCeremonyHost";
import {
  captureJournalSaveCeremonyLifecycle,
  invalidateJournalSaveCeremonyLifecycle,
  JOURNAL_SAVE_CEREMONY_CANCEL_EVENT,
  markJournalSaveCeremonyLifecycleActive,
  type JournalSaveCeremonyLifecycleToken,
} from "../save-ceremony/journalSaveCeremonyLifecycle";
import {
  isJournalSaveCeremonyRuntimePreloaded,
  startJournalSaveCeremony,
} from "../save-ceremony/journalSaveCeremonyRuntime";

const shouldAnimateMock = vi.fn(() => true);
const runtimePreloadedMock = vi.fn(() => true);

vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => shouldAnimateMock(),
}));

vi.mock("../save-ceremony/journalSaveCeremonyRuntime", () => ({
  isJournalSaveCeremonyCircuitOpen: vi.fn(() => false),
  isJournalSaveCeremonyRuntimePreloaded: () => runtimePreloadedMock(),
  startJournalSaveCeremony: vi.fn(async ({ onComplete }) => {
    const timer = setTimeout(() => onComplete(), 2_983);
    return {
      destroy: vi.fn(() => clearTimeout(timer)),
      ready: Promise.resolve(),
    };
  }),
}));

const receipt: JournalSaveCommitReceipt = {
  nonce: "receipt-nonce",
  operation: "create",
  entryId: "entry-private-id",
  deliveryState: "cloud-pending",
  committedAt: 10_000,
  appliedTheme: "paper",
  variant: "night",
};
let validLifecycle: JournalSaveCeremonyLifecycleToken;
let anchor: HTMLDivElement;

describe("JournalSaveCeremonyHost", () => {
  beforeEach(() => {
    document
      .querySelectorAll('[data-journal-save-anchor="true"]')
      .forEach((element) => element.remove());
    vi.useFakeTimers();
    vi.setSystemTime(10_500);
    shouldAnimateMock.mockReturnValue(true);
    runtimePreloadedMock.mockReturnValue(true);
    vi.mocked(startJournalSaveCeremony).mockClear();
    markJournalSaveCeremonyLifecycleActive();
    validLifecycle = captureJournalSaveCeremonyLifecycle();
    anchor = document.createElement("div");
    anchor.dataset.journalSaveAnchor = "true";
    anchor.getBoundingClientRect = () => ({
      x: 300,
      y: 240,
      left: 300,
      top: 240,
      right: 380,
      bottom: 320,
      width: 80,
      height: 80,
      toJSON: () => ({}),
    });
    document.body.append(anchor);
  });

  it("consumes once, plays the snapshotted variant and removes it after completion", async () => {
    const onConsume = vi.fn();
    const onFinish = vi.fn();
    render(
      <JournalSaveCeremonyHost
        receipt={receipt}
        lifecycleToken={validLifecycle}
        eligible
        onConsume={onConsume}
        onFinish={onFinish}
      />,
    );

    await act(async () => Promise.resolve());
    expect(onConsume).toHaveBeenCalledTimes(1);
    expect(onConsume).toHaveBeenCalledWith(receipt.nonce);
    expect(startJournalSaveCeremony).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "night" }),
    );
    expect(screen.getByTestId("journal-save-ceremony")).toHaveAttribute(
      "data-playback",
      "lottie",
    );
    expect(screen.getByTestId("journal-save-ceremony")).toHaveAttribute(
      "data-anchor",
      "entry",
    );
    expect(screen.getByTestId("journal-save-ceremony")).toHaveAttribute(
      "data-delivery-state",
      "cloud-pending",
    );
    expect(
      screen.getByTestId("journal-save-ceremony-player"),
    ).toHaveStyle({ left: "340px", top: "280px" });
    expect(document.body.innerHTML).not.toContain("entry-private-id");
    expect(screen.getByTestId("journal-save-ceremony-veil")).toHaveAttribute(
      "data-tone",
      "night",
    );
    expect(screen.getByTestId("journal-save-ceremony-veil")).toHaveAttribute(
      "data-motion",
      "animated",
    );

    await act(async () => {
      vi.advanceTimersByTime(2_983);
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith(receipt.nonce);
    expect(screen.queryByTestId("journal-save-ceremony")).not.toBeInTheDocument();
  });

  it("uses the static fallback when the saved entry is not present on the visible surface", async () => {
    anchor.remove();
    render(
      <JournalSaveCeremonyHost
        receipt={{ ...receipt, deliveryState: "local-saved" }}
        lifecycleToken={validLifecycle}
        eligible
        onConsume={vi.fn()}
      />,
    );

    await act(async () => Promise.resolve());

    expect(startJournalSaveCeremony).not.toHaveBeenCalled();
    expect(screen.getByTestId("journal-save-ceremony-static")).toBeInTheDocument();
    expect(screen.getByTestId("journal-save-ceremony")).toHaveAttribute(
      "data-anchor",
      "fallback",
    );
    expect(screen.getByTestId("journal-save-ceremony")).toHaveAttribute(
      "data-delivery-state",
      "local-saved",
    );
  });

  it("uses the exact decorative SVG for 800ms without constructing Lottie when motion is off", async () => {
    shouldAnimateMock.mockReturnValue(false);
    const onConsume = vi.fn();
    render(
      <JournalSaveCeremonyHost
        receipt={{ ...receipt, variant: "day", appliedTheme: "ink" }}
        lifecycleToken={validLifecycle}
        eligible
        onConsume={onConsume}
      />,
    );

    await act(async () => Promise.resolve());
    expect(onConsume).toHaveBeenCalledTimes(1);
    expect(startJournalSaveCeremony).not.toHaveBeenCalled();
    expect(screen.getByTestId("journal-save-ceremony-static")).toBeInTheDocument();
    expect(screen.getByTestId("journal-save-ceremony-veil")).toHaveAttribute(
      "data-motion",
      "static",
    );
    expect(screen.getByTestId("journal-save-ceremony-veil")).toHaveAttribute(
      "data-tone",
      "day",
    );

    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.queryByTestId("journal-save-ceremony")).not.toBeInTheDocument();
  });

  it("uses the exact static proof immediately when the runtime was not preloaded", async () => {
    runtimePreloadedMock.mockReturnValue(false);
    render(
      <JournalSaveCeremonyHost
        receipt={receipt}
        lifecycleToken={validLifecycle}
        eligible
        onConsume={vi.fn()}
      />,
    );

    await act(async () => Promise.resolve());
    expect(isJournalSaveCeremonyRuntimePreloaded()).toBe(false);
    expect(startJournalSaveCeremony).not.toHaveBeenCalled();
    expect(screen.getByTestId("journal-save-ceremony-static")).toBeInTheDocument();
  });

  it("does not start desktop Lottie below its 304px safe-bounded minimum", async () => {
    const previousWidth = window.innerWidth;
    const previousHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 900 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 340 });
    document.documentElement.style.setProperty("--safe-top", "20px");
    document.documentElement.style.setProperty("--safe-bottom", "20px");

    render(
      <JournalSaveCeremonyHost
        receipt={receipt}
        lifecycleToken={validLifecycle}
        eligible
        onConsume={vi.fn()}
      />,
    );
    await act(async () => Promise.resolve());

    expect(
      screen.getByTestId("journal-save-ceremony").lastElementChild,
    ).toHaveStyle({ width: "268px", height: "268px" });
    expect(startJournalSaveCeremony).not.toHaveBeenCalled();
    expect(screen.getByTestId("journal-save-ceremony-static")).toBeInTheDocument();

    document.documentElement.style.removeProperty("--safe-top");
    document.documentElement.style.removeProperty("--safe-bottom");
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: previousWidth,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: previousHeight,
    });
  });

  it("consumes an expired receipt without rendering or replaying it", async () => {
    vi.setSystemTime(20_001);
    const onConsume = vi.fn();
    const onFinish = vi.fn();
    render(
      <JournalSaveCeremonyHost
        receipt={receipt}
        lifecycleToken={validLifecycle}
        eligible
        onConsume={onConsume}
        onFinish={onFinish}
      />,
    );

    await act(async () => Promise.resolve());
    expect(onConsume).toHaveBeenCalledWith(receipt.nonce);
    expect(onFinish).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledWith(receipt.nonce);
    expect(startJournalSaveCeremony).not.toHaveBeenCalled();
    expect(screen.queryByTestId("journal-save-ceremony")).not.toBeInTheDocument();
  });

  it("consumes a lifecycle-invalidated receipt before admission and never replays it", async () => {
    markJournalSaveCeremonyLifecycleActive();
    const staleLifecycle = captureJournalSaveCeremonyLifecycle();
    invalidateJournalSaveCeremonyLifecycle();
    const onConsume = vi.fn();
    const onFinish = vi.fn();
    const { rerender } = render(
      <JournalSaveCeremonyHost
        receipt={receipt}
        lifecycleToken={staleLifecycle}
        eligible
        onConsume={onConsume}
        onFinish={onFinish}
      />,
    );

    await act(async () => Promise.resolve());
    expect(onConsume).toHaveBeenCalledWith(receipt.nonce);
    expect(onFinish).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledWith(receipt.nonce);
    expect(startJournalSaveCeremony).not.toHaveBeenCalled();
    expect(screen.queryByTestId("journal-save-ceremony")).not.toBeInTheDocument();

    markJournalSaveCeremonyLifecycleActive();
    rerender(
      <JournalSaveCeremonyHost
        receipt={receipt}
        lifecycleToken={staleLifecycle}
        eligible
        onConsume={onConsume}
        onFinish={onFinish}
      />,
    );
    await act(async () => Promise.resolve());

    expect(onConsume).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(startJournalSaveCeremony).not.toHaveBeenCalled();
    expect(screen.queryByTestId("journal-save-ceremony")).not.toBeInTheDocument();
  });

  it("destroys and consumes the current ceremony when the page is hidden", async () => {
    const destroy = vi.fn();
    vi.mocked(startJournalSaveCeremony).mockResolvedValueOnce({
      destroy,
      ready: Promise.resolve(),
    });
    const onConsume = vi.fn();
    const onFinish = vi.fn();
    render(
      <JournalSaveCeremonyHost
        receipt={receipt}
        lifecycleToken={validLifecycle}
        eligible
        onConsume={onConsume}
        onFinish={onFinish}
      />,
    );
    await act(async () => Promise.resolve());

    act(() => {
      window.dispatchEvent(new Event(JOURNAL_SAVE_CEREMONY_CANCEL_EVENT));
    });
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledWith(receipt.nonce);
    expect(screen.queryByTestId("journal-save-ceremony")).not.toBeInTheDocument();
  });

  it("aborts unfinished asset work when lifecycle cancellation destroys playback", async () => {
    render(
      <JournalSaveCeremonyHost
        receipt={receipt}
        lifecycleToken={validLifecycle}
        eligible
        onConsume={vi.fn()}
      />,
    );
    await act(async () => Promise.resolve());

    const options = vi.mocked(startJournalSaveCeremony).mock.calls[0]?.[0];
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.signal?.aborted).toBe(false);

    act(() => {
      window.dispatchEvent(new Event(JOURNAL_SAVE_CEREMONY_CANCEL_EVENT));
    });
    expect(options?.signal?.aborted).toBe(true);
  });

  it("never restarts one nonce after it degrades from Lottie to static", async () => {
    const { rerender } = render(
      <JournalSaveCeremonyHost
        receipt={receipt}
        lifecycleToken={validLifecycle}
        eligible
        onConsume={vi.fn()}
      />,
    );
    await act(async () => Promise.resolve());
    expect(startJournalSaveCeremony).toHaveBeenCalledTimes(1);

    shouldAnimateMock.mockReturnValue(false);
    rerender(
      <JournalSaveCeremonyHost
        receipt={receipt}
        lifecycleToken={validLifecycle}
        eligible
        onConsume={vi.fn()}
      />,
    );
    await act(async () => Promise.resolve());
    expect(screen.getByTestId("journal-save-ceremony-static")).toBeInTheDocument();

    shouldAnimateMock.mockReturnValue(true);
    rerender(
      <JournalSaveCeremonyHost
        receipt={receipt}
        lifecycleToken={validLifecycle}
        eligible
        onConsume={vi.fn()}
      />,
    );
    await act(async () => Promise.resolve());

    expect(startJournalSaveCeremony).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("journal-save-ceremony-static")).toBeInTheDocument();
  });

  it("yields immediately when keyboard navigation continues", async () => {
    const destroy = vi.fn();
    vi.mocked(startJournalSaveCeremony).mockResolvedValueOnce({
      destroy,
      ready: Promise.resolve(),
    });
    render(
      <JournalSaveCeremonyHost
        receipt={receipt}
        lifecycleToken={validLifecycle}
        eligible
        onConsume={vi.fn()}
      />,
    );
    await act(async () => Promise.resolve());

    fireEvent.keyDown(window, { key: "Tab" });

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("journal-save-ceremony")).not.toBeInTheDocument();
  });

  it("falls back to the approved static proof when the player misses its ready deadline", async () => {
    let resolvePlayer!: (playback: {
      destroy: () => void;
      ready: Promise<void>;
    }) => void;
    const destroy = vi.fn();
    vi.mocked(startJournalSaveCeremony).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePlayer = resolve;
        }),
    );

    render(
      <JournalSaveCeremonyHost
        receipt={receipt}
        lifecycleToken={validLifecycle}
        eligible
        onConsume={vi.fn()}
      />,
    );
    await act(async () => Promise.resolve());

    await act(async () => {
      vi.advanceTimersByTime(750);
    });
    expect(screen.getByTestId("journal-save-ceremony-static")).toBeInTheDocument();

    await act(async () => {
      resolvePlayer({ destroy, ready: Promise.resolve() });
      await Promise.resolve();
    });
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
