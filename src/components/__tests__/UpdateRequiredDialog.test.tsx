import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CHUNK_LOAD_ERROR_EVENT,
  setupChunkErrorHandler,
  UpdateRequiredDialog,
} from "@/components/UpdateRequiredDialog";
import { useBackHandler } from "@/hooks/useBackHandler";

const mockForceHardReload = vi.fn().mockResolvedValue(undefined);

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      updateRequiredTitle: "Доступне оновлення",
      updateRequiredDesc:
        "Доступна нова версія додатку. Оновіть для отримання нових функцій та виправлень.",
      updateRequiredRefresh: "Оновити додаток",
      updateRequiredRefreshFailed: "Не вдалося безпечно підготувати оновлення. Спробуйте ще раз.",
      cancel: "Скасувати",
    },
  }),
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  addBreadcrumb: vi.fn(),
}));

vi.mock("@/lib/versionCheck", () => ({
  forceHardReload: (...args: unknown[]) => mockForceHardReload(...args),
}));

describe("UpdateRequiredDialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("replays one chunk incident captured before the dialog mounts", async () => {
    setupChunkErrorHandler();
    window.dispatchEvent(
      new CustomEvent(CHUNK_LOAD_ERROR_EVENT, {
        detail: {
          chunk: "Language-uk-old.js",
          message: "Failed to fetch dynamically imported module",
        },
      }),
    );

    render(<UpdateRequiredDialog />);

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });

  it("consumes a pre-mount chunk incident instead of replaying it after remount", async () => {
    setupChunkErrorHandler();
    window.dispatchEvent(
      new CustomEvent(CHUNK_LOAD_ERROR_EVENT, {
        detail: {
          chunk: "Language-ar-old.js",
          message: "Failed to fetch dynamically imported module",
        },
      }),
    );

    const firstMount = render(<UpdateRequiredDialog />);
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    firstMount.unmount();

    render(<UpdateRequiredDialog />);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("uses hard reload when the user accepts a stale chunk update", async () => {
    render(<UpdateRequiredDialog />);

    window.dispatchEvent(
      new CustomEvent(CHUNK_LOAD_ERROR_EVENT, {
        detail: {
          chunk: "TabContent-old.js",
          message: "Failed to fetch dynamically imported module",
        },
      }),
    );

    const refresh = await screen.findByRole("button", { name: "Оновити додаток" });
    fireEvent.click(refresh);

    await waitFor(() => expect(mockForceHardReload).toHaveBeenCalledTimes(1));
  });

  it("moves focus into the alert dialog when it opens", async () => {
    const outside = document.createElement("button");
    outside.textContent = "Outside";
    document.body.append(outside);
    outside.focus();

    try {
      render(<UpdateRequiredDialog />);

      window.dispatchEvent(
        new CustomEvent(CHUNK_LOAD_ERROR_EVENT, {
          detail: { chunk: "Settings-old.js", message: "ChunkLoadError" },
        }),
      );

      const title = await screen.findByRole("heading", { name: "Доступне оновлення" });
      await waitFor(() => expect(title).toHaveFocus());
      expect(title).toHaveAttribute("tabindex", "-1");
      const activeElement = document.activeElement;
      expect(activeElement).toBeInstanceOf(HTMLElement);
      if (!(activeElement instanceof HTMLElement)) {
        throw new Error("Expected alert dialog focus to resolve to an HTML element");
      }
      expect(screen.getByRole("alertdialog")).toContainElement(activeElement);

      const pendingFrames: FrameRequestCallback[] = [];
      const animationFrameSpy = vi
        .spyOn(window, "requestAnimationFrame")
        .mockImplementation((callback) => {
          pendingFrames.push(callback);
          return pendingFrames.length;
        });

      fireEvent.click(screen.getByRole("button", { name: "Скасувати" }));
      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
      expect(pendingFrames).toHaveLength(1);
      pendingFrames.splice(0).forEach((callback) => callback(performance.now()));
      await waitFor(() => expect(outside).toHaveFocus());
      animationFrameSpy.mockRestore();
    } finally {
      outside.remove();
    }
  });

  it("keeps the download and refresh icons decorative in the accessibility tree", async () => {
    render(<UpdateRequiredDialog />);

    window.dispatchEvent(
      new CustomEvent(CHUNK_LOAD_ERROR_EVENT, {
        detail: { chunk: "Settings-old.js", message: "ChunkLoadError" },
      }),
    );

    const dialog = await screen.findByRole("alertdialog");
    const icons = dialog.querySelectorAll("svg");

    expect(icons).toHaveLength(2);
    for (const icon of icons) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("gives long localized copy a shrinkable wrapping layout", async () => {
    render(<UpdateRequiredDialog />);

    window.dispatchEvent(
      new CustomEvent(CHUNK_LOAD_ERROR_EVENT, {
        detail: { chunk: "Settings-old.js", message: "ChunkLoadError" },
      }),
    );

    const dialog = await screen.findByRole("alertdialog");
    const title = screen.getByRole("heading", { name: "Доступне оновлення" });
    const description = screen.getByText(/Доступна нова версія додатку/);
    const refresh = screen.getByRole("button", { name: "Оновити додаток" });
    const cancel = screen.getByRole("button", { name: "Скасувати" });
    const footer = refresh.parentElement;

    expect(dialog).toHaveClass(
      "min-w-0",
      "max-w-md",
      "overflow-y-auto",
      "w-[calc(100%-0.5rem)]",
      "p-1",
      "min-[360px]:w-[calc(100%-1rem)]",
      "min-[360px]:p-2",
      "min-[420px]:p-4",
      "sm:p-6",
    );
    expect(title.parentElement).toHaveClass("grid", "grid-cols-1", "min-w-0");
    expect(title).toHaveClass(
      "min-w-0",
      "break-words",
      "[hyphens:manual]",
      "[overflow-wrap:break-word]",
    );
    expect(description).toHaveClass(
      "min-w-0",
      "break-words",
      "[hyphens:manual]",
      "[overflow-wrap:break-word]",
    );
    expect(title.className).not.toContain("[overflow-wrap:anywhere]");
    expect(description.className).not.toContain("[overflow-wrap:anywhere]");
    expect(refresh).toHaveClass(
      "min-w-0",
      "max-w-full",
      "whitespace-normal",
      "px-1",
      "min-[420px]:px-3",
      "md:flex-row",
    );
    expect(refresh.className).not.toContain("min-[420px]:flex-row");
    expect(footer).toHaveClass("flex-col-reverse", "md:flex-row");
    expect(footer).not.toHaveClass("sm:flex-row");
    expect(screen.getByText("Оновити додаток", { selector: "span" })).toHaveClass(
      "min-w-0",
      "break-words",
      "[hyphens:manual]",
      "[overflow-wrap:break-word]",
    );
    expect(
      screen.getByText("Оновити додаток", { selector: "span" }).className,
    ).not.toContain("[overflow-wrap:anywhere]");
    expect(cancel).toHaveClass(
      "h-auto",
      "min-w-0",
      "max-w-full",
      "break-words",
      "[hyphens:manual]",
      "[overflow-wrap:break-word]",
      "px-1",
      "min-[420px]:px-3",
    );
    expect(cancel.className).not.toContain("[overflow-wrap:anywhere]");
  });

  it("keeps the app open and shows a retryable error when durable reload preparation fails", async () => {
    mockForceHardReload.mockRejectedValueOnce(new Error("draft write failed"));
    render(<UpdateRequiredDialog />);

    window.dispatchEvent(
      new CustomEvent(CHUNK_LOAD_ERROR_EVENT, {
        detail: { chunk: "JournalEditor-old.js", message: "ChunkLoadError" },
      }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Оновити додаток" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не вдалося безпечно підготувати оновлення. Спробуйте ще раз.",
    );
    expect(screen.getByRole("button", { name: "Оновити додаток" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveClass(
      "break-normal",
      "[hyphens:manual]",
      "[overflow-wrap:normal]",
    );
    expect(screen.getByRole("alert").className).not.toContain("[overflow-wrap:anywhere]");
  });

  it("keeps an in-flight reload visible when Escape is pressed", async () => {
    let rejectReload: ((reason?: unknown) => void) | undefined;
    mockForceHardReload.mockImplementationOnce(
      () => new Promise<boolean>((_resolve, reject) => { rejectReload = reject; }),
    );
    render(<UpdateRequiredDialog />);

    window.dispatchEvent(
      new CustomEvent(CHUNK_LOAD_ERROR_EVENT, {
        detail: { chunk: "JournalEditor-old.js", message: "ChunkLoadError" },
      }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Оновити додаток" }));
    expect(screen.getByRole("button", { name: "Оновити додаток" })).toBeDisabled();

    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    rejectReload?.(new Error("draft write failed"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("keeps an in-flight reload visible when Android back is pressed", async () => {
    let rejectReload: ((reason?: unknown) => void) | undefined;
    mockForceHardReload.mockImplementationOnce(
      () => new Promise<boolean>((_resolve, reject) => { rejectReload = reject; }),
    );
    render(<UpdateRequiredDialog />);

    window.dispatchEvent(
      new CustomEvent(CHUNK_LOAD_ERROR_EVENT, {
        detail: { chunk: "JournalEditor-old.js", message: "ChunkLoadError" },
      }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Оновити додаток" }));
    expect(screen.getByRole("button", { name: "Оновити додаток" })).toBeDisabled();

    const backHandler = vi.mocked(useBackHandler).mock.calls.at(-1)?.[1];
    backHandler?.();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    rejectReload?.(new Error("draft write failed"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("re-enables refresh when the reload-loop guard intentionally skips navigation", async () => {
    mockForceHardReload.mockResolvedValueOnce(false);
    render(<UpdateRequiredDialog />);

    window.dispatchEvent(
      new CustomEvent(CHUNK_LOAD_ERROR_EVENT, {
        detail: { chunk: "JournalEditor-old.js", message: "ChunkLoadError" },
      }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Оновити додаток" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не вдалося безпечно підготувати оновлення. Спробуйте ще раз.",
    );
    expect(screen.getByRole("button", { name: "Оновити додаток" })).toBeEnabled();
  });

  it("opens a later chunk incident without stale refresh failure state", async () => {
    mockForceHardReload.mockResolvedValueOnce(false);
    render(<UpdateRequiredDialog />);

    window.dispatchEvent(
      new CustomEvent(CHUNK_LOAD_ERROR_EVENT, {
        detail: { chunk: "JournalEditor-old.js", message: "ChunkLoadError" },
      }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Оновити додаток" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Скасувати" }));

    window.dispatchEvent(
      new CustomEvent(CHUNK_LOAD_ERROR_EVENT, {
        detail: { chunk: "Settings-new.js", message: "ChunkLoadError" },
      }),
    );

    expect(await screen.findByRole("heading", { name: "Доступне оновлення" })).toHaveFocus();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Оновити додаток" })).toBeEnabled();
  });

  it("keeps recovery locked when another chunk error arrives during reload preparation", async () => {
    let resolveOldRefresh: ((navigated: boolean) => void) | undefined;
    mockForceHardReload.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => { resolveOldRefresh = resolve; }),
    );
    render(<UpdateRequiredDialog />);

    window.dispatchEvent(
      new CustomEvent(CHUNK_LOAD_ERROR_EVENT, {
        detail: { chunk: "JournalEditor-old.js", message: "ChunkLoadError" },
      }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Оновити додаток" }));
    expect(screen.getByRole("button", { name: "Оновити додаток" })).toBeDisabled();

    window.dispatchEvent(
      new CustomEvent(CHUNK_LOAD_ERROR_EVENT, {
        detail: { chunk: "Settings-new.js", message: "ChunkLoadError" },
      }),
    );
    expect(screen.getByRole("button", { name: "Оновити додаток" })).toBeDisabled();

    resolveOldRefresh?.(false);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Оновити додаток" })).toBeEnabled();
  });
});
