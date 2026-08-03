import { forwardRef } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JournalPhoto } from "../types";
import { JournalPhotoGallery } from "../JournalPhotoGallery";

const { mockGetPhotoById, mockGetPhotoPreviewById } = vi.hoisted(() => ({
  mockGetPhotoById: vi.fn(),
  mockGetPhotoPreviewById: vi.fn(),
}));
const languageState = vi.hoisted<{ language: "en" | "ar" }>(() => ({ language: "en" }));
const modalA11yState = vi.hoisted(() => ({
  restoreFocusTo: null as React.RefObject<HTMLElement | null> | null,
}));

vi.mock("../journalStorage", () => ({
  getPhotoById: mockGetPhotoById,
  getPhotoPreviewById: mockGetPhotoPreviewById,
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: languageState.language,
    isRTL: false,
    t: {
      ariaPhotoLightbox: "Photo lightbox",
      close: "Close",
      delete: "Delete",
      journalPhotoNext: "Next photo",
      journalPhotoPrevious: "Previous photo",
      openPhoto: "Open photo",
      journalPhotoPosition: "Photo {current} of {total}",
      journalPhotoLoadError: "Some photos could not be shown. Your entry was not changed.",
      journalPhotoLoadRetry: "Try loading photos again",
      ariaFloatPhoto: "Place on page",
    },
  }),
}));

vi.mock("@/hooks/useDeviceTier", () => ({
  useDeviceTier: () => ({ isDesktopClass: false }),
}));

vi.mock("@/hooks/useScrollLock", () => ({
  useScrollLock: vi.fn(),
}));

vi.mock("@/hooks/useModalA11y", () => ({
  useModalA11y: (
    _isOpen: boolean,
    _onClose: () => void,
    restoreFocusTo?: React.RefObject<HTMLElement | null>,
  ) => {
    modalA11yState.restoreFocusTo = restoreFocusTo ?? null;
    return {
    handleKeyDown: vi.fn(),
    modalRef: { current: null },
    };
  },
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  useReducedMotion: () => false,
  motion: {
    div: forwardRef<HTMLDivElement, any>(
      ({ children, initial: _initial, animate: _animate, exit: _exit, ...props }, ref) => (
        <div ref={ref} {...props}>{children}</div>
      ),
    ),
    img: ({ alt = "", initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: any) => (
      <img alt={alt} {...props} />
    ),
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function photo(id: string): JournalPhoto {
  return {
    id,
    entryId: "entry-1",
    data: "",
    thumbnail: `data:image/jpeg;base64,thumb-${id}`,
    width: 1200,
    height: 800,
    createdAt: 1,
  };
}

describe("JournalPhotoGallery lightbox hydration", () => {
  beforeEach(() => {
    languageState.language = "en";
    mockGetPhotoById.mockReset();
    mockGetPhotoPreviewById.mockReset();
    mockGetPhotoById.mockImplementation(async (id: string) => photo(id));
    mockGetPhotoPreviewById.mockImplementation(async (id: string) => photo(id));
    modalA11yState.restoreFocusTo = null;
  });

  it("gives each photo a distinct position-aware accessible name", async () => {
    render(<JournalPhotoGallery entryId="entry-1" photoIds={["photo-a", "photo-b"]} />);

    expect(await screen.findByRole("button", { name: "Open photo. Photo 1 of 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open photo. Photo 2 of 2" })).toBeInTheDocument();
    expect(mockGetPhotoPreviewById).toHaveBeenCalledWith("photo-a", "entry-1");
    expect(mockGetPhotoPreviewById).toHaveBeenCalledWith("photo-b", "entry-1");
  });

  it("exposes a visible, specific command for placing a gallery photo on the page", async () => {
    const onFloatPhoto = vi.fn();
    render(
      <JournalPhotoGallery
        entryId="entry-1"
        photoIds={["photo-a"]}
        editable
        onFloatPhoto={onFloatPhoto}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Place on page" }));
    expect(onFloatPhoto).toHaveBeenCalledWith("photo-a");
    expect(screen.getByText("Place on page")).toBeVisible();
  });

  it("keeps the saved description associated with the gallery thumbnail and lightbox image", async () => {
    languageState.language = "ar";
    mockGetPhotoById.mockImplementation(async (id: string) => ({
      ...photo(id),
      data: `data:image/jpeg;base64,full-${id}`,
    }));
    render(
      <JournalPhotoGallery
        entryId="entry-1"
        photoIds={["photo-a"]}
        photoLayout={{
          "photo-a": {
            x: 34,
            y: 67,
            width: 240,
            description: "https://example.com/sunset",
            inGallery: true,
          },
        }}
      />,
    );

    const open = await screen.findByRole("button", { name: "Open photo. Photo ١ of ١" });
    const description = screen.getByText("\u2068https://example.com/sunset\u2069");
    expect(open).toHaveAttribute("aria-describedby", description.id);

    fireEvent.click(open);
    expect(
      await screen.findByRole("img", { name: "https://example.com/sunset" }),
    ).toBeInTheDocument();
  });

  it("localizes photo position digits for Arabic accessible names", async () => {
    languageState.language = "ar";
    render(<JournalPhotoGallery entryId="entry-1" photoIds={["photo-a", "photo-b"]} />);

    expect(
      await screen.findByRole("button", { name: "Open photo. Photo ١ of ٢" }),
    ).toBeInTheDocument();
  });

  it("keeps readable photos visible when one preview cannot be loaded", async () => {
    mockGetPhotoPreviewById.mockImplementation(async (id: string) => {
      if (id === "photo-b") throw new Error("corrupt preview");
      return photo(id);
    });

    render(
      <JournalPhotoGallery
        entryId="entry-1"
        photoIds={["photo-a", "photo-b", "photo-c"]}
      />,
    );

    expect(
      await screen.findByRole("button", { name: "Open photo. Photo 1 of 2" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open photo. Photo 2 of 2" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Some photos could not be shown. Your entry was not changed.",
    );
  });

  it("lets the user retry a failed photo load without changing the entry", async () => {
    mockGetPhotoPreviewById
      .mockRejectedValueOnce(new Error("temporary read failure"))
      .mockImplementation(async (id: string) => photo(id));

    render(<JournalPhotoGallery entryId="entry-1" photoIds={["photo-a"]} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Try loading photos again" }),
    );

    expect(
      await screen.findByRole("button", { name: "Open photo. Photo 1 of 1" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(mockGetPhotoPreviewById).toHaveBeenCalledTimes(2);
  });

  it("lets the user retry when a photo preview record is temporarily missing", async () => {
    mockGetPhotoPreviewById
      .mockResolvedValueOnce(undefined)
      .mockImplementation(async (id: string) => photo(id));

    render(<JournalPhotoGallery entryId="entry-1" photoIds={["photo-a"]} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Try loading photos again" }),
    );

    expect(
      await screen.findByRole("button", { name: "Open photo. Photo 1 of 1" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(mockGetPhotoPreviewById).toHaveBeenCalledTimes(2);
  });

  it("shows bounded recovery when a loaded thumbnail cannot be decoded", async () => {
    render(<JournalPhotoGallery entryId="entry-1" photoIds={["photo-a"]} />);

    const openPhoto = await screen.findByRole("button", {
      name: "Open photo. Photo 1 of 1",
    });
    fireEvent.error(openPhoto.querySelector("img") as HTMLImageElement);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Some photos could not be shown. Your entry was not changed.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try loading photos again" }));
    await waitFor(() => expect(mockGetPhotoPreviewById).toHaveBeenCalledTimes(2));
  });

  it("gives the opened full-size image a position-aware text alternative", async () => {
    mockGetPhotoById.mockImplementation(async (id: string) => ({
      ...photo(id),
      data: `data:image/jpeg;base64,full-${id}`,
    }));
    render(<JournalPhotoGallery entryId="entry-1" photoIds={["photo-a", "photo-b"]} />);

    fireEvent.click(await screen.findByRole("button", { name: "Open photo. Photo 1 of 2" }));
    const dialog = await screen.findByRole("dialog", { name: "Photo lightbox" });
    expect(dialog).toHaveClass("h-[var(--app-viewport-height)]");
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveClass(
      "top-[max(1rem,var(--safe-top))]",
      "end-[max(1rem,var(--safe-inline-end))]",
    );
    expect(within(dialog).getByRole("button", { name: "Previous photo" })).toHaveClass(
      "start-[max(1rem,var(--safe-inline-start))]",
    );
    expect(within(dialog).getByRole("button", { name: "Next photo" })).toHaveClass(
      "end-[max(1rem,var(--safe-inline-end))]",
    );
    expect(await screen.findByRole("img", { name: "Photo 1 of 2" })).toHaveClass(
      "max-w-[calc(100vw-var(--safe-left)-var(--safe-right)-2rem)]",
      "max-h-[calc(var(--app-viewport-height)-var(--safe-top)-var(--safe-bottom)-4rem)]",
    );
    expect(screen.getByRole("status", { name: "Photo 1 of 2" })).toHaveClass(
      "bg-black/80",
      "text-white",
      "bottom-[max(1rem,var(--safe-bottom))]",
    );

    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(screen.getByRole("status", { name: "Photo 2 of 2" })).toBeInTheDocument();
  });

  it("shows a clear thumbnail fallback and bounded retry when full-size decode fails", async () => {
    mockGetPhotoById.mockImplementation(async (id: string) => ({
      ...photo(id),
      data: `data:image/jpeg;base64,corrupt-full-${id}`,
    }));
    render(<JournalPhotoGallery entryId="entry-1" photoIds={["photo-a"]} />);

    fireEvent.click(await screen.findByRole("button", { name: "Open photo. Photo 1 of 1" }));
    const dialog = await screen.findByRole("dialog", { name: "Photo lightbox" });
    const lightboxImage = await within(dialog).findByRole("img", { name: "Photo 1 of 1" });
    await waitFor(() =>
      expect(lightboxImage).toHaveAttribute(
        "src",
        "data:image/jpeg;base64,corrupt-full-photo-a",
      ),
    );
    fireEvent.error(lightboxImage);

    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Some photos could not be shown. Your entry was not changed.",
    );
    expect(lightboxImage).toHaveAttribute("src", "data:image/jpeg;base64,thumb-photo-a");
    expect(lightboxImage).not.toHaveClass("blur-sm");

    fireEvent.click(within(dialog).getByRole("button", { name: "Try loading photos again" }));
    await waitFor(() => expect(mockGetPhotoById).toHaveBeenCalledTimes(2));
  });

  it("shows recovery when the full-size photo record is missing", async () => {
    mockGetPhotoById.mockResolvedValue(undefined);
    render(<JournalPhotoGallery entryId="entry-1" photoIds={["photo-a"]} />);

    fireEvent.click(await screen.findByRole("button", { name: "Open photo. Photo 1 of 1" }));
    const dialog = await screen.findByRole("dialog", { name: "Photo lightbox" });
    const lightboxImage = await within(dialog).findByRole("img", { name: "Photo 1 of 1" });

    expect(await within(dialog).findByRole("status")).toHaveTextContent(
      "Some photos could not be shown. Your entry was not changed.",
    );
    expect(lightboxImage).toHaveAttribute("src", "data:image/jpeg;base64,thumb-photo-a");

    fireEvent.click(within(dialog).getByRole("button", { name: "Try loading photos again" }));
    await waitFor(() => expect(mockGetPhotoById).toHaveBeenCalledTimes(2));
  });

  it("keeps retry focus inside the lightbox while retrying, after failure, and after success", async () => {
    const successfulRetry = deferred<JournalPhoto | undefined>();
    mockGetPhotoById
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => successfulRetry.promise);
    render(<JournalPhotoGallery entryId="entry-1" photoIds={["photo-a"]} />);

    fireEvent.click(await screen.findByRole("button", { name: "Open photo. Photo 1 of 1" }));
    const dialog = await screen.findByRole("dialog", { name: "Photo lightbox" });
    let retryButton = await within(dialog).findByRole("button", {
      name: "Try loading photos again",
    });

    retryButton.focus();
    fireEvent.click(retryButton);
    expect(retryButton).toHaveFocus();
    expect(retryButton).toBeDisabled();

    await waitFor(() => expect(mockGetPhotoById).toHaveBeenCalledTimes(2));
    retryButton = within(dialog).getByRole("button", { name: "Try loading photos again" });
    expect(retryButton).toHaveFocus();
    expect(retryButton).toBeEnabled();

    fireEvent.click(retryButton);
    expect(retryButton).toHaveFocus();
    expect(retryButton).toBeDisabled();
    await act(async () => {
      successfulRetry.resolve({
        ...photo("photo-a"),
        data: "data:image/jpeg;base64,full-photo-a",
      });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Close" })).toHaveFocus(),
    );
    expect(within(dialog).queryByRole("button", { name: "Try loading photos again" })).toBeNull();
  });

  it("keeps focus inside the lightbox when navigating during a pending retry", async () => {
    const pendingRetry = deferred<JournalPhoto | undefined>();
    mockGetPhotoById
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => pendingRetry.promise)
      .mockResolvedValueOnce({
        ...photo("photo-b"),
        data: "data:image/jpeg;base64,full-photo-b",
      });
    render(<JournalPhotoGallery entryId="entry-1" photoIds={["photo-a", "photo-b"]} />);

    fireEvent.click(await screen.findByRole("button", { name: "Open photo. Photo 1 of 2" }));
    const dialog = await screen.findByRole("dialog", { name: "Photo lightbox" });
    const retryButton = await within(dialog).findByRole("button", {
      name: "Try loading photos again",
    });
    retryButton.focus();
    fireEvent.click(retryButton);
    expect(retryButton).toHaveFocus();
    expect(retryButton).toBeDisabled();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Close" })).toHaveFocus(),
    );
    expect(within(dialog).getByRole("status", { name: "Photo 2 of 2" })).toBeInTheDocument();

    await act(async () => {
      pendingRetry.resolve({
        ...photo("photo-a"),
        data: "data:image/jpeg;base64,full-photo-a",
      });
      await Promise.resolve();
    });
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveFocus();
    expect(within(dialog).getByRole("img", { name: "Photo 2 of 2" })).toHaveAttribute(
      "src",
      "data:image/jpeg;base64,full-photo-b",
    );
  });

  it("discards an older full-image response after navigating to another photo", async () => {
    const first = deferred<JournalPhoto | undefined>();
    const second = deferred<JournalPhoto | undefined>();
    mockGetPhotoById.mockImplementation((id: string) =>
      id === "photo-a" ? first.promise : second.promise,
    );

    render(<JournalPhotoGallery entryId="entry-1" photoIds={["photo-a", "photo-b"]} />);

    const openButtons = await screen.findAllByRole("button", { name: /Open photo\. Photo \d+ of 2/ });
    fireEvent.click(openButtons[0]);
    const dialog = await screen.findByRole("dialog", { name: "Photo lightbox" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Next photo" }));

    await act(async () => {
      second.resolve({ ...photo("photo-b"), data: "data:image/jpeg;base64,full-photo-b" });
      await Promise.resolve();
    });
    const lightboxImage = dialog.querySelector("img");
    expect(lightboxImage).toHaveAttribute("src", "data:image/jpeg;base64,full-photo-b");

    await act(async () => {
      first.resolve({ ...photo("photo-a"), data: "data:image/jpeg;base64,full-photo-a" });
      await Promise.resolve();
    });
    expect(lightboxImage).toHaveAttribute("src", "data:image/jpeg;base64,full-photo-b");
  });

  it("ignores a full-image response after its lightbox was closed", async () => {
    const pending = deferred<JournalPhoto | undefined>();
    mockGetPhotoById.mockReturnValue(pending.promise);

    render(<JournalPhotoGallery entryId="entry-1" photoIds={["photo-a"]} />);

    const openButton = await screen.findByRole("button", { name: "Open photo. Photo 1 of 1" });
    fireEvent.click(openButton);
    const dialog = await screen.findByRole("dialog", { name: "Photo lightbox" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await act(async () => {
      pending.resolve({ ...photo("photo-a"), data: "data:image/jpeg;base64,full-photo-a" });
      await Promise.resolve();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("returns focus to a surviving thumbnail after deleting the open photo", async () => {
    const onRemovePhoto = vi.fn();
    const { rerender } = render(
      <JournalPhotoGallery
        entryId="entry-1"
        photoIds={["photo-a", "photo-b"]}
        editable
        onRemovePhoto={onRemovePhoto}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Open photo. Photo 1 of 2" }));
    const dialog = await screen.findByRole("dialog", { name: "Photo lightbox" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    rerender(
      <JournalPhotoGallery
        entryId="entry-1"
        photoIds={["photo-b"]}
        editable
        onRemovePhoto={onRemovePhoto}
      />,
    );

    const survivingThumbnail = await screen.findByRole("button", {
      name: "Open photo. Photo 1 of 1",
    });
    expect(onRemovePhoto).toHaveBeenCalledWith("photo-a");
    expect(modalA11yState.restoreFocusTo?.current).toBe(survivingThumbnail);
    expect(modalA11yState.restoreFocusTo?.current?.isConnected).toBe(true);
  });
});
