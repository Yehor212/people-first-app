import { forwardRef } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JournalPhoto } from "../types";
import { JournalPhotoGallery } from "../JournalPhotoGallery";

const { mockGetPhotoById, mockGetPhotoPreviewById } = vi.hoisted(() => ({
  mockGetPhotoById: vi.fn(),
  mockGetPhotoPreviewById: vi.fn(),
}));

vi.mock("../journalStorage", () => ({
  getPhotoById: mockGetPhotoById,
  getPhotoPreviewById: mockGetPhotoPreviewById,
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    isRTL: false,
    t: {
      ariaPhotoLightbox: "Photo lightbox",
      close: "Close",
      delete: "Delete",
      journalPhotoNext: "Next photo",
      journalPhotoPrevious: "Previous photo",
      openPhoto: "Open photo",
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
  useModalA11y: () => ({
    handleKeyDown: vi.fn(),
    modalRef: { current: null },
  }),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
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
    mockGetPhotoById.mockReset();
    mockGetPhotoPreviewById.mockReset();
    mockGetPhotoPreviewById.mockImplementation(async (id: string) => photo(id));
  });

  it("discards an older full-image response after navigating to another photo", async () => {
    const first = deferred<JournalPhoto | undefined>();
    const second = deferred<JournalPhoto | undefined>();
    mockGetPhotoById.mockImplementation((id: string) =>
      id === "photo-a" ? first.promise : second.promise,
    );

    render(<JournalPhotoGallery entryId="entry-1" photoIds={["photo-a", "photo-b"]} />);

    const openButtons = await screen.findAllByRole("button", { name: "Open photo" });
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

    const openButton = await screen.findByRole("button", { name: "Open photo" });
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
});
