import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JournalPhotoPicker } from "../JournalPhotoPicker";

vi.mock("@/lib/platform", () => ({ isNative: false }));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: {
      ariaPhotoPicker: "Photo picker",
      close: "Close",
      journalPhotoAdd: "Add photo",
      journalPhotoChoose: "From gallery",
      journalCompressing: "Preparing photo...",
      journalPhotoError: "Failed to add photo. Try again.",
      journalPhotoProcessingTimeout: "Photo processing took too long. Try a smaller photo.",
      journalPhotoStorageFull:
        "There is not enough space on this device. Free some space, then try again.",
      journalPhotoRemainingCountOne: "{count} remaining",
      journalPhotoRemainingCountOther: "{count} remaining",
    },
  }),
}));
vi.mock("@/hooks/useScrollLock", () => ({ useScrollLock: vi.fn() }));
vi.mock("@/hooks/useBackHandler", () => ({ useBackHandler: vi.fn() }));

describe("JournalPhotoPicker busy lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("lets the user cancel processing and closes only after abort is observed", async () => {
    let processingSignal: AbortSignal | undefined;
    const onSelectFile = vi.fn((_file: File, signal?: AbortSignal) => {
      processingSignal = signal;
      return new Promise<void>((_resolve, reject) => {
        signal?.addEventListener(
          "abort",
          () => {
            const error = new Error("cancelled");
            error.name = "AbortError";
            reject(error);
          },
          { once: true },
        );
      });
    });
    const onClose = vi.fn();
    const { container } = render(
      <JournalPhotoPicker
        onSelectFile={onSelectFile}
        onClose={onClose}
        currentCount={0}
        maxCount={5}
      />,
    );

    const galleryInput = container.querySelectorAll<HTMLInputElement>('input[type="file"]')[1];
    const file = new File(["photo"], "memory.jpg", { type: "image/jpeg" });
    fireEvent.change(galleryInput, { target: { files: [file] } });

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Preparing photo...");
    expect(status).toHaveFocus();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    const closeButton = screen.getByRole("button", { name: "Close" });
    expect(closeButton).toBeEnabled();
    fireEvent.click(closeButton);

    expect(processingSignal?.aborted).toBe(true);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("returns focus to the photo trigger after processing fails", async () => {
    const onSelectFile = vi.fn(() => Promise.reject(new Error("decode failed")));
    const { container } = render(
      <JournalPhotoPicker
        onSelectFile={onSelectFile}
        onClose={vi.fn()}
        currentCount={0}
        maxCount={5}
      />,
    );

    const trigger = screen.getByRole("button", { name: "From gallery" });
    trigger.focus();
    const galleryInput = container.querySelectorAll<HTMLInputElement>('input[type="file"]')[1];
    fireEvent.change(galleryInput, {
      target: { files: [new File(["photo"], "memory.jpg", { type: "image/jpeg" })] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to add photo. Try again.");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "From gallery" })).toHaveFocus();
    });
  });

  it("explains how to recover when the device storage quota is exhausted", async () => {
    const onSelectFile = vi.fn(() =>
      Promise.reject(new DOMException("Storage quota reached", "QuotaExceededError")),
    );
    const { container } = render(
      <JournalPhotoPicker
        onSelectFile={onSelectFile}
        onClose={vi.fn()}
        currentCount={0}
        maxCount={5}
      />,
    );

    const galleryInput = container.querySelectorAll<HTMLInputElement>('input[type="file"]')[1];
    fireEvent.change(galleryInput, {
      target: { files: [new File(["photo"], "memory.jpg", { type: "image/jpeg" })] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "There is not enough space on this device. Free some space, then try again.",
    );
  });

  it("stops the processing spinner when reduced motion is requested", async () => {
    const onSelectFile = vi.fn(() => new Promise<void>(() => undefined));
    const { container } = render(
      <JournalPhotoPicker
        onSelectFile={onSelectFile}
        onClose={vi.fn()}
        currentCount={0}
        maxCount={5}
      />,
    );

    const galleryInput = container.querySelectorAll<HTMLInputElement>('input[type="file"]')[1];
    fireEvent.change(galleryInput, {
      target: { files: [new File(["photo"], "memory.jpg", { type: "image/jpeg" })] },
    });

    const spinner = (await screen.findByRole("status")).querySelector("svg");
    expect(spinner).toHaveClass("motion-safe:animate-spin");
    expect(spinner).not.toHaveClass("animate-spin");
  });

  it("aborts stalled processing and returns to a recoverable picker state", async () => {
    vi.useFakeTimers();
    let processingSignal: AbortSignal | undefined;
    const onSelectFile = vi.fn((_file: File, signal?: AbortSignal) => {
      processingSignal = signal;
      return new Promise<void>(() => undefined);
    });
    const onClose = vi.fn();
    const { container } = render(
      <JournalPhotoPicker
        onSelectFile={onSelectFile}
        onClose={onClose}
        currentCount={0}
        maxCount={5}
      />,
    );

    const galleryInput = container.querySelectorAll<HTMLInputElement>('input[type="file"]')[1];
    fireEvent.change(galleryInput, {
      target: { files: [new File(["photo"], "memory.jpg", { type: "image/jpeg" })] },
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(processingSignal?.aborted).toBe(true);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Photo processing took too long. Try a smaller photo.",
    );
    expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
